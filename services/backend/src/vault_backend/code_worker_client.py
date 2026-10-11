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
                        failure.metadata = {
                            "failure_code": "worker_busy"
                            if response.status_code == 429
                            else "worker_unavailable"
                        }
                        return failure
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > 1048576:
                            failure.metadata = {"failure_code": "response_too_large"}
                            return failure
                        body.extend(chunk)
                    result = CodeResult.model_validate_json(bytes(body))
            if result.request_sha256 != snapshot_hash:
                failure.metadata = {"failure_code": "result_binding_mismatch"}
                return failure
            return result
        except asyncio.CancelledError:
            await self._confirm_cancel(job_id)
            raise
        except (httpx.HTTPError, ValidationError, ValueError) as error:
            # No automatic retry: an uncertain response must not execute twice.
            failure.metadata = {
                "failure_code": "transport_timeout"
                if isinstance(error, httpx.TimeoutException)
                else "transport_unavailable"
                if isinstance(error, httpx.HTTPError)
                else "invalid_result"
            }
            return failure

    async def health(self) -> dict | None:
        """Return the worker readiness report, or None when unreachable.

        Cheap and read-only: it never submits a run and must not contend with
        the worker's single in-flight job or with its isolate box.
        """
        try:
            async with httpx.AsyncClient(
                transport=self.transport,
                trust_env=False,
                timeout=httpx.Timeout(5.0, connect=2.0),
            ) as http:
                reply = await http.get(
                    self.url + "/v1/health",
                    headers={"Authorization": "Bearer " + self.token},
                )
        except (httpx.HTTPError, ValueError):
            return None
        if reply.status_code != 200:
            return None
        try:
            return reply.json()
        except ValueError:
            return None


async def assess_code_execution(
    *,
    code_worker_url: str | None,
    environment: str,
    client: CodeWorkerClient | None,
) -> dict:
    """Split isolated execution readiness into independently testable states.

    - configured: a worker URL/token pair is present on the API process;
    - healthy: the worker answered the authenticated readiness probe and its
      isolate runtime is actually available;
    - production_ready: additionally requires an https worker gateway and the
      production environment (loopback http development is never production).
    """
    configured = client is not None and bool(code_worker_url)
    report = await client.health() if configured else None
    healthy = bool(
        report is not None
        and report.get("status") == "ready"
        and report.get("available") is True
    )
    scheme = urlsplit(code_worker_url).scheme.lower() if code_worker_url else ""
    production_ready = (
        configured
        and healthy
        and environment == "production"
        and scheme == "https"
    )
    return {
        "configured": configured,
        "healthy": healthy,
        "production_ready": production_ready,
        "engine": (report or {}).get("engine"),
    }
