import asyncio

import httpx
import pytest

from vault_backend.code_execution import CodeRequest, request_hash
from vault_backend.code_worker_client import CodeWorkerClient, assess_code_execution


class FakeHealth:
    def __init__(self, report):
        self._report = report

    async def health(self):
        return self._report


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


async def test_worker_busy_is_diagnosable_without_exposing_worker_body_or_retrying():
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        return httpx.Response(429, text="private worker secret body")

    client = CodeWorkerClient(
        "http://127.0.0.1:8091", "test-only-token", transport=httpx.MockTransport(handler)
    )
    request = CodeRequest(language="c17", entry="main.c", files={"main.c": "int main(){}"})
    result = await client.run(request)
    assert result.metadata == {"failure_code": "worker_busy"}
    assert result.status == "environment_error" and result.mastery_asserted is False
    assert calls == 1
    assert "secret" not in result.model_dump_json()


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


async def test_worker_client_health_forwards_authenticated_report():
    def handler(request):
        assert request.url.path == "/v1/health"
        assert request.headers["authorization"] == "Bearer test-only-token"
        return httpx.Response(
            200, json={"status": "ready", "engine": "isolate", "available": True}
        )

    client = CodeWorkerClient(
        "http://127.0.0.1:8091", "test-only-token", transport=httpx.MockTransport(handler)
    )
    assert await client.health() == {
        "status": "ready",
        "engine": "isolate",
        "available": True,
    }


async def test_worker_client_health_returns_none_without_retrying_or_leaking():
    client = CodeWorkerClient(
        "http://127.0.0.1:8091",
        "test-only-token",
        transport=httpx.MockTransport(lambda request: httpx.Response(500, text="worker secret")),
    )
    assert await client.health() is None

    def broken(request):
        raise httpx.ConnectError("worker down")

    client = CodeWorkerClient(
        "http://127.0.0.1:8091", "test-only-token", transport=httpx.MockTransport(broken)
    )
    assert await client.health() is None


async def test_assess_unconfigured_worker_is_false_in_every_state():
    result = await assess_code_execution(
        code_worker_url=None, environment="test", client=None
    )
    assert result == {
        "configured": False,
        "healthy": False,
        "production_ready": False,
        "engine": None,
    }


async def test_assess_healthy_loopback_dev_is_usable_but_not_production_ready():
    healthy = FakeHealth({"status": "ready", "engine": "isolate", "available": True})
    result = await assess_code_execution(
        code_worker_url="http://127.0.0.1:8091",
        environment="development",
        client=healthy,
    )
    assert result["configured"] is True
    assert result["healthy"] is True
    assert result["production_ready"] is False
    assert result["engine"] == "isolate"


async def test_assess_production_ready_requires_https_and_available_engine():
    healthy = FakeHealth({"status": "ready", "engine": "isolate", "available": True})
    loopback_http = await assess_code_execution(
        code_worker_url="http://127.0.0.1:8091",
        environment="production",
        client=healthy,
    )
    assert loopback_http["production_ready"] is False

    https_ready = await assess_code_execution(
        code_worker_url="https://worker.example.test",
        environment="production",
        client=FakeHealth({"status": "ready", "engine": "isolate", "available": True}),
    )
    assert https_ready["production_ready"] is True

    # A reachable process whose isolate engine is unavailable is not healthy and
    # therefore cannot be production ready.
    unavailable = await assess_code_execution(
        code_worker_url="https://worker.example.test",
        environment="production",
        client=FakeHealth({"status": "ready", "engine": "isolate", "available": False}),
    )
    assert unavailable["healthy"] is False
    assert unavailable["production_ready"] is False

    # Configured URL but the probe fails (worker down / auth rejected).
    unreachable = await assess_code_execution(
        code_worker_url="http://127.0.0.1:8091",
        environment="development",
        client=FakeHealth(None),
    )
    assert unreachable["configured"] is True
    assert unreachable["healthy"] is False
    assert unreachable["production_ready"] is False
