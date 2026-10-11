from uuid import UUID, uuid4

import httpx
import pytest
from test_algebra_registry import registry_work as registry_work

from vault_backend.api import create_app
from vault_backend.errors import ApiError
from vault_backend.guests import GuestLeaseStore
from vault_backend.responses import OperationResponse

ORIGIN = "http://localhost:5173"


async def grant(store):
    nonce = await store.nonce(ORIGIN)
    return await store.create(nonce["nonce"], ORIGIN)


async def test_native_checker_needs_no_code_worker_and_returns_typed_response(
    settings, registry_work
):
    registry, work, _, _ = registry_work
    store = GuestLeaseStore(settings, algebra_registry=registry)
    lease = await grant(store)
    assert "verify_finite_algebra" in lease["allowed_operations"]
    operation = await store.start(UUID(lease["lease_id"]), lease["token"], ORIGIN, uuid4(), work)
    parsed = OperationResponse.model_validate(operation)
    assert parsed.status == "completed"
    assert parsed.result.prediction_correct
    assert parsed.result.mastery_asserted is False
    assert store.leases[UUID(lease["lease_id"])].operations[parsed.operation_id].submission is None


async def test_native_checker_is_idempotent_and_discards_acknowledged_result(
    settings, registry_work
):
    registry, work, _, _ = registry_work
    store = GuestLeaseStore(settings, algebra_registry=registry)
    lease = await grant(store)
    args = (UUID(lease["lease_id"]), lease["token"], ORIGIN, uuid4())
    first = await store.start(*args, work)
    assert first == await store.start(*args, work)
    with pytest.raises(ApiError) as caught:
        await store.start(*args, work.model_copy(update={"explanation": "另一个工件"}))
    assert caught.value.status == 409
    other = await grant(store)
    with pytest.raises(ApiError):
        await store.snapshot(UUID(other["lease_id"]), other["token"], UUID(first["operation_id"]))
    acknowledged = await store.ack(
        args[0], args[1], ORIGIN, UUID(first["operation_id"]), first["revision"]
    )
    assert acknowledged["result"] is None
    assert (await store.start(*args, work))["result"] is None


async def test_invalid_native_context_does_not_consume_operation_budget(settings, registry_work):
    registry, work, _, _ = registry_work
    store = GuestLeaseStore(settings, algebra_registry=registry)
    lease = await grant(store)
    with pytest.raises(ApiError):
        await store.start(
            UUID(lease["lease_id"]),
            lease["token"],
            ORIGIN,
            uuid4(),
            work.model_copy(update={"objective_code": "CS05-M01-O01"}),
        )
    assert not store.leases[UUID(lease["lease_id"])].operations


async def test_http_native_operation_uses_typed_body_and_rejects_client_report(
    settings, registry_work
):
    registry, work, _, _ = registry_work
    store = GuestLeaseStore(settings, algebra_registry=registry)
    lease = await grant(store)
    app = create_app(settings, store)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN) as client:
        path = f"/api/v1/guest-leases/{lease['lease_id']}/operations"
        headers = {
            "Origin": ORIGIN,
            "Authorization": "GuestLease " + lease["token"],
            "Idempotency-Key": str(uuid4()),
        }
        payload = work.model_dump(mode="json")
        response = await client.post(path, headers=headers, json=payload)
        assert response.status_code == 201, response.text
        assert response.json()["result"]["prediction_correct"]
        forged = {**payload, "report": {"is_group": True}}
        response = await client.post(
            path, headers={**headers, "Idempotency-Key": str(uuid4())}, json=forged
        )
        assert response.status_code == 422
