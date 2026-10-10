import httpx

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
