from uuid import UUID, uuid4

import pytest

from vault_backend.errors import ApiError
from vault_backend.guests import digest
from vault_backend.schemas import OperationInput, TraceSubmission

ORIGIN = "http://localhost:5173"


async def lease(store):
    nonce = await store.nonce(ORIGIN)
    return await store.create(nonce["nonce"], ORIGIN)


async def start(store, grant, submission, key=None):
    return await store.start(
        UUID(grant["lease_id"]), grant["token"], ORIGIN, key or uuid4(), submission
    )


async def test_token_only_digest_in_store(store):
    grant = await lease(store)
    stored = store.leases[UUID(grant["lease_id"])]
    assert stored.token_digest == digest(grant["token"])
    assert grant["token"] not in repr(stored)


async def test_nonce_replay_and_cross_origin_rejected(store):
    nonce = await store.nonce(ORIGIN)
    await store.create(nonce["nonce"], ORIGIN)
    with pytest.raises(ApiError) as caught:
        await store.create(nonce["nonce"], ORIGIN)
    assert caught.value.code == "NONCE_INVALID"
    with pytest.raises(ApiError) as caught:
        await store.nonce("https://attacker.invalid")
    assert caught.value.code == "ORIGIN_REJECTED"


async def test_duplicate_returns_single_verification(store, submission):
    grant = await lease(store)
    key = uuid4()
    first = await start(store, grant, submission, key)
    second = await start(store, grant, submission, key)
    assert first == second
    assert len(store.leases[UUID(grant["lease_id"])].operations) == 1
    changed = submission.model_copy(update={"explanation": "changed"})
    with pytest.raises(ApiError) as caught:
        await start(store, grant, changed, key)
    assert caught.value.code == "IDEMPOTENCY_CONFLICT"


async def test_other_lease_cannot_read_result(store, submission):
    a, b = await lease(store), await lease(store)
    operation = await start(store, a, submission)
    with pytest.raises(ApiError) as caught:
        await store.snapshot(UUID(b["lease_id"]), b["token"], UUID(operation["operation_id"]))
    assert caught.value.status == 404
    with pytest.raises(ApiError) as caught:
        await store.snapshot(UUID(a["lease_id"]), b["token"], UUID(operation["operation_id"]))
    assert caught.value.status == 401


async def test_poll_does_not_extend_idle_and_expiry_purges(store, clock, submission):
    grant = await lease(store)
    op = await start(store, grant, submission)
    clock.advance(9)
    await store.snapshot(UUID(grant["lease_id"]), grant["token"], UUID(op["operation_id"]))
    clock.advance(1)
    with pytest.raises(ApiError) as caught:
        await store.snapshot(UUID(grant["lease_id"]), grant["token"], UUID(op["operation_id"]))
    assert caught.value.code == "GUEST_LEASE_EXPIRED"
    assert not store.leases


async def test_user_input_cannot_extend_absolute_expiry(store, clock, submission):
    grant = await lease(store)
    for _ in range(3):
        await start(store, grant, submission)
        clock.advance(9)
    await start(store, grant, submission)
    clock.advance(3)
    await store.prune()
    assert not store.leases


async def test_ack_discards_result_and_events_but_retains_idempotency(store, submission):
    grant = await lease(store)
    key = uuid4()
    op = await start(store, grant, submission, key)
    args = (UUID(grant["lease_id"]), grant["token"], ORIGIN, UUID(op["operation_id"]), "1")
    acknowledged = await store.ack(*args)
    assert acknowledged["result"] is None
    assert acknowledged["acknowledged"] is True
    assert (await store.ack(*args)) == acknowledged
    assert (await start(store, grant, submission, key))["result"] is None
    internal = store.leases[UUID(grant["lease_id"])].operations[UUID(op["operation_id"])]
    assert internal.submission is None
    assert all(event["operation"]["result"] is None for event in internal.events)


async def test_cancel_waiting_and_reject_late_input(store, trace_payload):
    pending = TraceSubmission.model_validate({**trace_payload, "trace": None})
    grant = await lease(store)
    op = await start(store, grant, pending)
    args = (UUID(grant["lease_id"]), grant["token"], ORIGIN, UUID(op["operation_id"]))
    cancelled = await store.cancel(*args, "1")
    assert cancelled["status"] == "cancelled"
    assert cancelled["result"] is None
    late = OperationInput.model_validate(
        {
            "op_id": uuid4(),
            "expected_revision": "1",
            "trace": trace_payload["trace"],
            "explanation": "late",
        }
    )
    with pytest.raises(ApiError) as caught:
        await store.input(*args, late)
    assert caught.value.code == "OPERATION_NOT_WAITING"


async def test_input_revision_and_duplicate(store, trace_payload):
    pending = TraceSubmission.model_validate({**trace_payload, "trace": None})
    grant = await lease(store)
    op = await start(store, grant, pending)
    args = (UUID(grant["lease_id"]), grant["token"], ORIGIN, UUID(op["operation_id"]))
    body = OperationInput.model_validate(
        {
            "op_id": uuid4(),
            "expected_revision": "1",
            "trace": trace_payload["trace"],
            "explanation": "new",
        }
    )
    result = await store.input(*args, body)
    assert result["revision"] == "2"
    assert result["result"]["trace_correct"] is True
    assert await store.input(*args, body) == result


async def test_sse_cursor_replay_and_ack_window(store, submission):
    grant = await lease(store)
    op = await start(store, grant, submission)
    args = (UUID(grant["lease_id"]), grant["token"], UUID(op["operation_id"]))
    events, terminal = await store.events(*args, 0)
    assert terminal and len(events) == 1
    assert events[0]["sequence"] == "1"
    assert await store.events(*args, 1) == ([], True)
    await store.ack(args[0], args[1], ORIGIN, args[2], "1")
    with pytest.raises(ApiError) as caught:
        await store.events(*args, 0)
    assert caught.value.code == "EVENT_CURSOR_EXPIRED"


async def test_capacity_limits_without_unbounded_payload(store, submission):
    grant = await lease(store)
    for _ in range(store.settings.guest_max_operations):
        await start(store, grant, submission)
    with pytest.raises(ApiError) as caught:
        await start(store, grant, submission)
    assert caught.value.status == 429


async def test_process_restart_is_explicit_state_loss(store, settings, clock, submission):
    from vault_backend.guests import GuestLeaseStore

    grant = await lease(store)
    op = await start(store, grant, submission)
    restarted = GuestLeaseStore(settings, clock, trace_context=store.trace_context)
    with pytest.raises(ApiError) as caught:
        await restarted.snapshot(UUID(grant["lease_id"]), grant["token"], UUID(op["operation_id"]))
    assert caught.value.code == "GUEST_LEASE_EXPIRED"


async def test_sse_connections_bounded_and_ttl_reclaims_capacity(store, clock, submission):
    grant = await lease(store)
    operation = await start(store, grant, submission)
    args = (UUID(grant["lease_id"]), grant["token"], UUID(operation["operation_id"]))
    first = await store.acquire_stream(*args)
    await store.acquire_stream(*args)
    with pytest.raises(ApiError) as caught:
        await store.acquire_stream(*args)
    assert caught.value.code == "GUEST_STREAM_LIMIT"
    await store.release_stream(args[0], first)
    await store.acquire_stream(*args)
    clock.advance(10)
    await store.prune()
    assert not store.active_streams
