import asyncio

import httpx
import pytest

from vault_backend.code_execution import CodeRequest, request_hash
from vault_backend.code_worker_client import CodeWorkerClient


async def test_worker_client_validates_binding_and_separates_transport_faults():
    request = CodeRequest(language="c17", entry="main.c", files={"main.c": "int main(){}"})
    response = {
        "status": "success",
        "phase": "run",
        "runtime_profile": "c17-isolate-dev@0.1.0",
        "request_sha256": request_hash(request),
        "mastery_asserted": False,
    }

    def handler(http_request):
        assert http_request.headers["authorization"] == "Bearer test-only-token"
        return httpx.Response(200, json=response)

    client = CodeWorkerClient(
        "http://127.0.0.1:8091", "test-only-token", transport=httpx.MockTransport(handler)
    )
    assert (await client.run(request)).status == "success"
    response["request_sha256"] = "wrong-snapshot"
    assert (await client.run(request)).status == "environment_error"
    response["request_sha256"] = request_hash(request)
    response["mastery_asserted"] = True
    assert (await client.run(request)).status == "environment_error"


async def test_worker_timeout_and_http_faults_do_not_retry_execution():
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("dummy timeout")

    client = CodeWorkerClient(
        "http://127.0.0.1:8091", "test-only-token", transport=httpx.MockTransport(handler)
    )
    request = CodeRequest(language="c17", entry="main.c", files={"main.c": "int main(){}"})
    result = await client.run(request)
    assert result.status == "environment_error"
    assert len(calls) == 1


async def test_client_cancellation_requests_the_same_job_and_waits_for_receipt():
    started, confirmed = asyncio.Event(), asyncio.Event()
    job_id = ""

    async def handler(request):
        nonlocal job_id
        if request.url.path == "/v1/runs":
            job_id = request.headers["x-execution-id"]
            started.set()
            await asyncio.Event().wait()
        assert request.url.path == "/v1/runs/" + job_id + "/cancel"
        await asyncio.sleep(0.02)
        confirmed.set()
        return httpx.Response(200, json={"execution_id": job_id, "cleanup_confirmed": True})

    client = CodeWorkerClient(
        "http://127.0.0.1:8091", "test-only-token", transport=httpx.MockTransport(handler)
    )
    request = CodeRequest(language="c17", entry="main.c", files={"main.c": "int main(){}"})
    task = asyncio.create_task(client.run(request))
    try:
        await asyncio.wait_for(started.wait(), 1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert confirmed.is_set()
    finally:
        if not task.done():
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
