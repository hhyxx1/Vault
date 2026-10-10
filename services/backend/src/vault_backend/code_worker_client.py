"""Business-host client: forward controlled snapshots, never spawn student code."""

import asyncio
import json
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from pydantic import ValidationError

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash


class CleanupUnconfirmed(RuntimeError):
    """No receipt exists proving remote execution resources were reclaimed."""


class CodeWorkerClient:
    def __init__(self, url: str, token: str, *, transport: httpx.AsyncBaseTransport | None = None):
        parsed = urlsplit(url)
        if (
            not token
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in ("", "/")
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname
        ):
            raise ValueError("invalid private worker configuration")
        if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("non-loopback workers require an authenticated HTTPS gateway")
        self.url, self.token, self.transport = url.rstrip("/"), token, transport

    async def _confirm_cancel(self, job_id: str):
        try:
            async with httpx.AsyncClient(
                transport=self.transport, trust_env=False, timeout=httpx.Timeout(30, connect=5)
            ) as client:
                async with client.stream(
                    "POST",
                    self.url + "/v1/runs/" + job_id + "/cancel",
                    headers={"Authorization": "Bearer " + self.token},
                ) as reply:
                    if reply.status_code != 200:
                        raise CleanupUnconfirmed("execution cleanup was not confirmed")
                    body = bytearray()
                    async for chunk in reply.aiter_bytes():
                        if len(body) + len(chunk) > 1024:
                            raise CleanupUnconfirmed("invalid cleanup receipt")
                        body.extend(chunk)
                    receipt = json.loads(body)
                    if (
                        not isinstance(receipt, dict)
                        or receipt.get("execution_id") != job_id
                        or receipt.get("cleanup_confirmed") is not True
                    ):
                        raise CleanupUnconfirmed("invalid cleanup receipt")
        except (httpx.HTTPError, ValueError):
            raise CleanupUnconfirmed("execution cleanup was not confirmed") from None

    async def run(self, submission: CodeRequest) -> CodeResult:
        snapshot_hash = request_hash(submission)
        job_id = str(uuid4())
        failure = CodeResult(
            status="environment_error",
            phase="prepare",
            runtime_profile=submission.language + "-isolate-dev@0.1.0",
            request_sha256=snapshot_hash,
        )
        try:
            async with httpx.AsyncClient(
                transport=self.transport, trust_env=False, timeout=httpx.Timeout(100, connect=5)
            ) as client:
                async with client.stream(
                    "POST",
                    self.url + "/v1/runs",
                    headers={"Authorization": "Bearer " + self.token, "X-Execution-ID": job_id},
                    json=submission.model_dump(),
                ) as response:
                    if response.status_code != 200:
                        return failure
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > 1048576:
                            return failure
                        body.extend(chunk)
                    result = CodeResult.model_validate_json(bytes(body))
            if result.request_sha256 != snapshot_hash:
                return failure
            return result
        except asyncio.CancelledError:
            await self._confirm_cancel(job_id)
            raise
        except (httpx.HTTPError, ValidationError, ValueError):
            # No automatic retry: an uncertain response must not execute twice.
            return failure
