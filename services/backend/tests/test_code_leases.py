import asyncio
from uuid import UUID, uuid4

import httpx
import pytest

from vault_backend.api import create_app
from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
from vault_backend.errors import ApiError
from vault_backend.guests import GuestLeaseStore
from vault_backend.schemas import CodeSubmission

ORIGIN = "http://localhost:5173"


class Runner:
    def __init__(self):
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.cancelled = asyncio.Event()
        self.calls = 0

    async def run(self, request):
        self.calls += 1
        self.started.set()
        try:
            await self.release.wait()
        except asyncio.CancelledError:
            self.cancelled.set()
            raise
        return CodeResult(
            status="success",
            phase="run",
            stdout="42\n",
            runtime_profile="c17-isolate-dev@0.1.0",
            request_sha256=request_hash(request),
        )


async def grant(store):
    nonce = await store.nonce(ORIGIN)
    result = await store.create(nonce["nonce"], ORIGIN)
    return UUID(result["lease_id"]), result["token"]


def submission():
    return CodeSubmission(
        kind="run_code",
        client_artifact_id=uuid4(),
        client_revision_id=uuid4(),
        code=CodeRequest(language="c17", entry="main.c", files={"main.c": "int main(){}"}),
    )


async def test_code_job_is_idempotent_and_does_not_hold_store_lock(settings):
    runner = Runner()
    store = GuestLeaseStore(settings, code_runner=runner)
    lease_id, token = await grant(store)
    body, key = submission(), uuid4()
    first = await store.start(lease_id, token, ORIGIN, key, body)
    assert first["status"] == "running"
    await runner.started.wait()
    duplicate = await asyncio.wait_for(store.start(lease_id, token, ORIGIN, key, body), 1)
    assert duplicate["operation_id"] == first["operation_id"] and runner.calls == 1
    runner.release.set()
    for _ in range(20):
        result = await store.snapshot(lease_id, token, UUID(first["operation_id"]))
        if result["status"] == "completed":
            break
        await asyncio.sleep(0)
    assert result["result"]["request_sha256"] == request_hash(body.code)
    assert result["result"]["client_revision_id"] == str(body.client_revision_id)
    await store.close()


async def test_cancel_waits_for_execution_cleanup(settings):
    runner = Runner()
    store = GuestLeaseStore(settings, code_runner=runner)
    lease_id, token = await grant(store)
    job = await store.start(lease_id, token, ORIGIN, uuid4(), submission())
    await runner.started.wait()
    result = await store.cancel(lease_id, token, ORIGIN, UUID(job["operation_id"]), job["revision"])
    assert result["status"] == "cancelled" and runner.cancelled.is_set()
    assert result["result"] is None
    await store.close()


async def test_expiry_and_shutdown_cancel_pending_jobs(settings, clock):
    runner = Runner()
    store = GuestLeaseStore(settings, now=clock, code_runner=runner)
    lease_id, token = await grant(store)
    await store.start(lease_id, token, ORIGIN, uuid4(), submission())
    await runner.started.wait()
    clock.advance(11)
    await store.prune()
    assert runner.cancelled.is_set() and not store.leases
    await store.close()


async def test_missing_worker_is_unavailable_not_a_student_failure(settings):
    store = GuestLeaseStore(settings)
    lease_id, token = await grant(store)
    with pytest.raises(ApiError) as caught:
        await store.start(lease_id, token, ORIGIN, uuid4(), submission())
    assert caught.value.status == 503
    await store.close()


async def test_api_exposes_running_and_bound_result_without_grading(settings):
    runner = Runner()
    store = GuestLeaseStore(settings, code_runner=runner)
    app = create_app(settings, store)
    lease_id, token = await grant(store)
    body = submission()
    headers = {
        "Origin": ORIGIN,
        "Authorization": "GuestLease " + token,
        "Idempotency-Key": str(uuid4()),
    }
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url=ORIGIN) as client:
        path = f"/api/v1/guest-leases/{lease_id}/operations"
        response = await client.post(path, json=body.model_dump(mode="json"), headers=headers)
        assert response.status_code == 201, response.text
        assert response.json()["status"] == "running"
        await runner.started.wait()
        runner.release.set()
        await asyncio.sleep(0)
        snapshot = (
            await client.get(path + "/" + response.json()["operation_id"], headers=headers)
        ).json()
        assert snapshot["status"] == "completed", snapshot
        assert snapshot["result"]["client_artifact_id"] == str(body.client_artifact_id)
        assert snapshot["result"]["mastery_asserted"] is False
    await store.close()


async def test_shutdown_before_job_starts_does_not_leak_task_admission(settings):
    store = GuestLeaseStore(settings, code_runner=Runner())
    lease_id, token = await grant(store)
    await store.start(lease_id, token, ORIGIN, uuid4(), submission())
    await store.close()
    assert not store.code_tasks


async def test_unconfirmed_cleanup_is_visible_and_blocks_new_execution(settings):
    from vault_backend.code_worker_client import CleanupUnconfirmed

    class BrokenCleanupRunner(Runner):
        async def run(self, request):
            self.started.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                raise CleanupUnconfirmed("dummy missing receipt") from None

    runner = BrokenCleanupRunner()
    store = GuestLeaseStore(settings, code_runner=runner)
    lease_id, token = await grant(store)
    job = await store.start(lease_id, token, ORIGIN, uuid4(), submission())
    await runner.started.wait()
    result = await store.cancel(lease_id, token, ORIGIN, UUID(job["operation_id"]), job["revision"])
    assert result["result"]["status"] == "environment_error"
    assert result["result"]["phase"] == "cleanup"
    with pytest.raises(ApiError) as caught:
        await store.start(lease_id, token, ORIGIN, uuid4(), submission())
    assert caught.value.status == 503
    await store.close()
