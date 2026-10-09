from uuid import uuid4

import httpx
import pytest

from vault_backend.api import create_app
from vault_backend.course_checks.structured_trace import get_trace_spec

ORIGIN = "http://localhost:5173"


@pytest.fixture
def app(settings, store):
    return create_app(settings, store)


@pytest.fixture
async def client(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN) as client:
        yield client


async def grant(client):
    nonce = await client.get("/api/v1/guest-nonce")
    assert nonce.status_code == 200
    response = await client.post(
        "/api/v1/guest-leases", headers={"Origin": ORIGIN}, json={"nonce": nonce.json()["nonce"]}
    )
    assert response.status_code == 201
    return response.json()


async def test_health_reports_partial_without_database(client):
    assert (await client.get("/api/v1/health/live")).json()["status"] == "alive"
    ready = await client.get("/api/v1/health/ready")
    assert ready.status_code == 503
    assert ready.json()["features"]["accounts"] is False
    assert ready.json()["features"]["isolated_execution"] is False


async def test_real_trace_and_sse_resume(client, trace_payload):
    lease = await grant(client)
    path = f"/api/v1/guest-leases/{lease['lease_id']}/operations"
    headers = {
        "Origin": ORIGIN,
        "Authorization": f"GuestLease {lease['token']}",
        "Idempotency-Key": str(uuid4()),
    }
    result = await client.post(path, headers=headers, json=trace_payload)
    assert result.status_code == 201, result.text
    operation = result.json()
    assert operation["result"]["trace_correct"] is True
    assert operation["result"]["mastery_asserted"] is False
    assert operation["result"]["course_id"]
    events_path = f"{path}/{operation['operation_id']}/events"
    events = await client.get(events_path, headers={**headers, "Last-Event-ID": "0"})
    assert "id: 1\nevent: verification.completed\n" in events.text
    replay = await client.get(events_path, headers={**headers, "Last-Event-ID": "1"})
    assert replay.text == ""
    assert result.headers["Cache-Control"] == "no-store"
    assert "X-Request-ID" in result.headers


async def test_logic_table_is_checked_per_cell_without_asserting_mastery(client):
    lease = await grant(client)
    path = f"/api/v1/guest-leases/{lease['lease_id']}/operations"
    headers = {
        "Origin": ORIGIN,
        "Authorization": f"GuestLease {lease['token']}",
        "Idempotency-Key": str(uuid4()),
    }
    payload = {
        "kind": "verify_truth_table",
        "course_code": "CS05",
        "activity_version": "CS05-LOGIC-01-TABLE@0.1.0",
        "standard_version": "propositional-table-v1",
        "client_artifact_id": str(uuid4()),
        "client_revision_id": str(uuid4()),
        "rows": [
            {"implication": True, "contrapositive": True, "biconditional": True},
            {"implication": True, "contrapositive": True, "biconditional": False},
            {"implication": False, "contrapositive": False, "biconditional": False},
            {"implication": True, "contrapositive": True, "biconditional": True},
        ],
        "explanation": "P 真而 Q 假时蕴含为假；逆否命题逐行同值。",
    }
    response = await client.post(path, headers=headers, json=payload)
    assert response.status_code == 201, response.text
    operation = response.json()
    assert operation["kind"] == "verify_truth_table"
    assert operation["result"]["course_code"] == "CS05"
    assert operation["result"]["rows"][2]["correct"] is True
    assert operation["result"]["mastery_asserted"] is False
    assert operation["result"]["criteria"][-1]["status"] == "needs_review"
    altered = {
        **payload,
        "rows": [{**payload["rows"][0], "implication": False}, *payload["rows"][1:]],
    }
    changed = await client.post(
        path, headers={**headers, "Idempotency-Key": str(uuid4())}, json=altered
    )
    assert changed.status_code == 201, changed.text
    assert changed.json()["result"]["rows"][0]["correct"] is False
    assert changed.json()["result"]["criteria"][0]["status"] == "not_met"
    forged = await client.post(
        path,
        headers={**headers, "Idempotency-Key": str(uuid4())},
        json={**payload, "mastery_asserted": True},
    )
    assert forged.status_code == 422


def _structured_payload(activity_version, *, mutate=None, drop_steps=0):
    spec = get_trace_spec(activity_version)
    steps = spec.expected_submission_steps()
    if drop_steps:
        steps = steps[:-drop_steps]
    payload = {
        "kind": "verify_structured_trace",
        "course_code": "CS03",
        "activity_version": activity_version,
        "client_artifact_id": str(uuid4()),
        "client_revision_id": str(uuid4()),
        "steps": steps,
        "explanation": "我按操作顺序逐步记录每次操作后的状态，失败的出栈/入队不改变状态。",
    }
    if mutate is not None:
        mutate(payload)
    return payload


async def _post_operation(client, lease, payload):
    return await client.post(
        f"/api/v1/guest-leases/{lease['lease_id']}/operations",
        headers={
            "Origin": ORIGIN,
            "Authorization": f"GuestLease {lease['token']}",
            "Idempotency-Key": str(uuid4()),
        },
        json=payload,
    )


async def test_structured_trace_stack_and_queue_verified(client):
    lease = await grant(client)
    assert "verify_structured_trace" in lease["allowed_operations"]

    stack = await _post_operation(client, lease, _structured_payload("CS03-STACK-U01-TRACE@0.1.0"))
    assert stack.status_code == 201, stack.text
    operation = stack.json()
    assert operation["kind"] == "verify_structured_trace"
    result = operation["result"]
    assert result["trace_correct"] is True
    assert result["mastery_asserted"] is False
    assert result["course_id"] == "e7b6a2d4-dee6-4ee6-98b5-13afc2c880ca"
    assert result["activity_id"] == "7c1e5a01-0001-4a00-8000-000000000001"
    assert result["objective_ids"] == ["e790d0f5-ea0a-4924-a482-06b9ff8ab944"]
    statuses = {criterion["id"]: criterion["status"] for criterion in result["criteria"]}
    assert statuses["stack.order"] == "met"
    assert statuses["stack.bounds"] == "met"
    assert statuses["explanation"] == "needs_review"
    assert statuses["independent_transfer"] == "needs_review"
    assert result["objective_state"] == "evidence_pending_review"

    queue = await _post_operation(client, lease, _structured_payload("CS03-QUEUE-U02-TRACE@0.1.0"))
    assert queue.status_code == 201, queue.text
    qresult = queue.json()["result"]
    assert qresult["trace_correct"] is True
    qstatuses = {criterion["id"]: criterion["status"] for criterion in qresult["criteria"]}
    assert qstatuses["queue.fifo"] == "met"
    assert qstatuses["queue.wrap"] == "met"
    assert qstatuses["queue.bounds"] == "met"
    assert qresult["objective_ids"] == ["c9049f14-1182-406e-a632-d6eeb2c9053c"]

    # A pop that returns the bottom instead of the top is caught.
    wrong = _structured_payload(
        "CS03-STACK-U01-TRACE@0.1.0",
        mutate=lambda payload: payload["steps"][3].__setitem__("value", 4),
    )
    bad = await _post_operation(client, lease, wrong)
    assert bad.status_code == 201, bad.text
    assert bad.json()["result"]["trace_correct"] is False
    assert any(criterion["status"] == "not_met" for criterion in bad.json()["result"]["criteria"])


async def test_structured_trace_shape_and_envelope_rejected(client):
    lease = await grant(client)

    short = _structured_payload("CS03-STACK-U01-TRACE@0.1.0", drop_steps=1)
    response = await _post_operation(client, lease, short)
    assert response.status_code == 422
    assert "TRACE_SHAPE_INVALID" in response.text

    unknown = _structured_payload("CS03-STACK-U01-TRACE@0.1.0")
    unknown["activity_version"] = "CS99-NOPE@9.9.9"
    assert (await _post_operation(client, lease, unknown)).status_code == 422

    forged = _structured_payload("CS03-STACK-U01-TRACE@0.1.0")
    forged["standard_version"] = "forged-standard"
    assert (await _post_operation(client, lease, forged)).status_code == 422


async def test_validation_error_redacts_input(client, trace_payload):
    lease = await grant(client)
    trace_payload["owner_account_id"] = "secret-private-name"
    response = await client.post(
        f"/api/v1/guest-leases/{lease['lease_id']}/operations",
        headers={
            "Origin": ORIGIN,
            "Authorization": f"GuestLease {lease['token']}",
            "Idempotency-Key": str(uuid4()),
        },
        json=trace_payload,
    )
    assert response.status_code == 422
    assert "secret-private-name" not in response.text
    assert lease["token"] not in response.text


async def test_missing_origin_and_wrong_nonce(client):
    response = await client.post("/api/v1/guest-leases", json={"nonce": "x" * 43})
    assert response.status_code == 403
    assert response.json()["code"] == "ORIGIN_REQUIRED"


async def test_actual_chunked_body_limit(client):
    async def chunks():
        yield b"x" * 32000
        yield b"x" * 34000

    response = await client.post(
        "/api/v1/guest-leases", content=chunks(), headers={"Origin": ORIGIN}
    )
    assert response.status_code == 413
    assert "xxxx" not in response.text


async def test_execution_adapter_is_unavailable_not_local_execution(client):
    response = await client.post(
        "/api/v1/execution-jobs", json={"source": "raise RuntimeError('do not run')"}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "EXECUTION_UNAVAILABLE"


async def test_catalog_honestly_separates_planned_courses(client):
    response = await client.get("/api/v1/courses")
    assert response.status_code == 200
    courses = response.json()["courses"]
    assert len(courses) == 13
    assert not any(course["full_course_available"] for course in courses)
    assert {course["code"] for course in courses if course["objective_count"] is not None} == {
        "CS03", "CS05"
    }


async def test_origin_is_not_wildcard_cors(client):
    response = await client.options(
        "/api/v1/guest-leases",
        headers={"Origin": "https://attacker.invalid", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 400
    assert response.headers.get("Access-Control-Allow-Origin") is None


async def test_nonce_post_binds_browser_origin_despite_proxy_host(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8000"
    ) as proxied:
        origin = "http://localhost:5173"
        nonce = await proxied.post("/api/v1/guest-nonce", headers={"Origin": origin})
        assert nonce.status_code == 200
        lease = await proxied.post(
            "/api/v1/guest-leases",
            headers={"Origin": origin},
            json={"nonce": nonce.json()["nonce"]},
        )
        assert lease.status_code == 201
        assert lease.json()["storage"] == "ephemeral_memory"
        untrusted = await proxied.post(
            "/api/v1/guest-nonce",
            headers={"Origin": "https://attacker.invalid", "X-Forwarded-Host": "localhost:5173"},
        )
        assert untrusted.status_code == 403
        missing = await proxied.post("/api/v1/guest-nonce")
        assert missing.status_code == 403
        assert missing.json()["code"] == "ORIGIN_REQUIRED"


async def test_full_scope_directory_and_every_version_are_discoverable(client):
    response = await client.get("/api/v1/course-scopes")
    assert response.status_code == 200
    courses = response.json()["courses"]
    assert len(courses) == 13
    assert sum(course["objective_count"] for course in courses) == 366
    for course in courses:
        assert "package_path" not in course
        assert course["learning_ready"] is False
        package = await client.get(
            f"/api/v1/courses/{course['id']}/versions/{course['version_id']}"
        )
        assert package.status_code == 200
        assert len(package.json()["objectives"]) == course["objective_count"]
