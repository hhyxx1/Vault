"""Business-host client: forward controlled snapshots, never spawn student code."""

from urllib.parse import urlsplit

import httpx
from pydantic import ValidationError

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash


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

    async def run(self, submission: CodeRequest) -> CodeResult:
        snapshot_hash = request_hash(submission)
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
                    headers={"Authorization": "Bearer " + self.token},
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
        except (httpx.HTTPError, ValidationError, ValueError):
            # No automatic retry: an uncertain response must not execute twice.
            return failure
