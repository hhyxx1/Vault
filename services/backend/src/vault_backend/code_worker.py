"""Private E01 worker transport. Run on the dedicated execution host, not the API.

The browser never receives the worker token. The caller must enforce its own
lease, consent, budget and immutable submission binding before using this API.
"""

import asyncio
import os
import secrets
from contextlib import suppress
from typing import Protocol

from fastapi import FastAPI, HTTPException, Request
from pydantic import ValidationError

from vault_backend.code_execution import CodeRequest, CodeResult, IsolateWorker


class Controller(Protocol):
    async def run(self, request: CodeRequest) -> CodeResult: ...


def create_worker_app(token: str, controller: Controller | None = None) -> FastAPI:
    if len(token) < 32 or not token.strip() or "\n" in token or "\r" in token:
        raise ValueError("a private worker token of at least 32 characters is required")
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    runner = controller or IsolateWorker()
    busy = False

    @app.post("/v1/runs", response_model=CodeResult)
    async def run(request: Request):
        nonlocal busy
        authorization = request.headers.get("authorization", "")
        if not secrets.compare_digest(authorization.encode(), ("Bearer " + token).encode()):
            raise HTTPException(401, "worker authentication required")
        # No await between admission check and assignment: one job, no queue.
        if busy:
            raise HTTPException(429, "worker busy", headers={"Retry-After": "1"})
        busy = True
        execution = None
        disconnected = None
        try:
            body = bytearray()
            try:
                async with asyncio.timeout(10):
                    async for chunk in request.stream():
                        if len(body) + len(chunk) > 524288:
                            raise HTTPException(413, "request exceeds worker limit")
                        body.extend(chunk)
            except TimeoutError:
                raise HTTPException(408, "request timed out") from None
            try:
                submission = CodeRequest.model_validate_json(bytes(body))
            except ValidationError:
                # Never echo source or raw validation input into HTTP errors.
                raise HTTPException(422, "invalid code submission") from None

            async def wait_disconnect():
                while True:
                    if (await request.receive())["type"] == "http.disconnect":
                        return

            execution = asyncio.create_task(runner.run(submission))
            disconnected = asyncio.create_task(wait_disconnect())
            completed, _ = await asyncio.wait(
                {execution, disconnected}, return_when=asyncio.FIRST_COMPLETED
            )
            if disconnected in completed:
                raise HTTPException(499, "caller disconnected")
            return execution.result()
        finally:
            # IsolateWorker cancellation awaits process, mount and cgroup cleanup.
            # Admission only reopens after cancellation has actually completed.
            try:
                for task in (execution, disconnected):
                    if task is not None:
                        if not task.done():
                            task.cancel()
                        with suppress(asyncio.CancelledError):
                            await task
            finally:
                if disconnected is not None and not disconnected.done():
                    disconnected.cancel()
                    with suppress(asyncio.CancelledError):
                        await disconnected
                busy = False

    return app


def main():
    import uvicorn

    app = create_worker_app(os.environ.get("VAULT_CODE_WORKER_TOKEN", ""))
    # Deliberately loopback-only for local development. Dedicated-host deployment
    # needs a private authenticated gateway, never a direct public root worker.
    uvicorn.run(app, host="127.0.0.1", port=8091, access_log=False)


if __name__ == "__main__":
    main()
