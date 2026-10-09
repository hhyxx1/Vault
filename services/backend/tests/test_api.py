from uuid import uuid4

import httpx
import pytest

from vault_backend.api import create_app

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
