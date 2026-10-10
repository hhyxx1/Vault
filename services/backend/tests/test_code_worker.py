import asyncio

import httpx
import pytest

from vault_backend.code_execution import CodeResult
from vault_backend.code_worker import create_worker_app

TOKEN = "test-only-worker-token-" + "x" * 32
BODY = {"language": "c17", "entry": "main.c", "files": {"main.c": "int main(){}"}}


class Controller:
    def __init__(self):
        self.calls = 0
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.release.set()

    async def run(self, request):
        self.calls += 1
        self.started.set()
        await self.release.wait()
        return CodeResult(status="success", phase="run", runtime_profile="test-only")


async def test_worker_auth_and_validation_precede_execution():
    controller = Controller()
    app = create_worker_app(TOKEN, controller)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app), base_url="http://worker"
    ) as client:
        assert (await client.post("/v1/runs", json=BODY)).status_code == 401
        headers = {"Authorization": "Bearer " + TOKEN}
        invalid = {**BODY, "entry": "../../secret"}
        assert (await client.post("/v1/runs", json=invalid, headers=headers)).status_code == 422
        assert controller.calls == 0
        result = await client.post("/v1/runs", json=BODY, headers=headers)
        assert result.status_code == 200
        assert result.json()["mastery_asserted"] is False
        assert controller.calls == 1


async def test_worker_rejects_busy_and_oversized_requests_without_queue():
    controller = Controller()
    app = create_worker_app(TOKEN, controller)
    headers = {"Authorization": "Bearer " + TOKEN}
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app), base_url="http://worker"
    ) as client:
        large = await client.post("/v1/runs", content=b"x" * 524289, headers=headers)
        assert large.status_code == 413 and controller.calls == 0
        controller.release.clear()
        first = asyncio.create_task(client.post("/v1/runs", json=BODY, headers=headers))
        await asyncio.wait_for(controller.started.wait(), 1)
        assert (await client.post("/v1/runs", json=BODY, headers=headers)).status_code == 429
        controller.release.set()
        assert (await first).status_code == 200
        assert (await client.post("/v1/runs", json=BODY, headers=headers)).status_code == 200


def test_worker_requires_a_nonempty_private_token():
    with pytest.raises(ValueError):
        create_worker_app("")


async def test_disconnect_cancels_execution_and_waits_for_cleanup():
    import json

    cleaned = asyncio.Event()

    class WaitingController:
        async def run(self, request):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                await asyncio.sleep(0.02)
                cleaned.set()

    started = asyncio.Event()
    messages = asyncio.Queue()
    await messages.put({"type": "http.request", "body": json.dumps(BODY).encode()})
    sent = []

    async def send(message):
        sent.append(message)

    app = create_worker_app(TOKEN, WaitingController())
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/v1/runs",
        "raw_path": b"/v1/runs",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"authorization", ("Bearer " + TOKEN).encode())],
    }
    task = asyncio.create_task(app(scope, messages.get, send))
    await asyncio.wait_for(started.wait(), 1)
    await messages.put({"type": "http.disconnect"})
    await asyncio.wait_for(task, 1)
    assert cleaned.is_set()
    assert sent[0]["status"] == 499


async def test_controller_exception_releases_admission():
    class OnceBrokenController(Controller):
        async def run(self, request):
            if self.calls == 0:
                self.calls += 1
                raise OSError("dummy controller failure")
            return await super().run(request)

    app = create_worker_app(TOKEN, OnceBrokenController())
    transport = httpx.ASGITransport(app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://worker") as client:
        headers = {"Authorization": "Bearer " + TOKEN}
        assert (await client.post("/v1/runs", json=BODY, headers=headers)).status_code == 500
        assert (await client.post("/v1/runs", json=BODY, headers=headers)).status_code == 200
