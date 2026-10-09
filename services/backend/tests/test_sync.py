"""Real PostgreSQL + HTTP tests for ownership, replay, versions and local trust.

Accounts and sessions are synthetic database rows, not mocked authorization.
The authentication suite separately exercises password and email lifecycles.
"""

import asyncio
import copy
import hashlib
import json
import os
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient

from vault_backend.api import create_app
from vault_backend.auth import SESSION_COOKIE, csrf_for, digest
from vault_backend.checker import verify_trace, verify_truth_table
from vault_backend.config import Settings
from vault_backend.content import CourseRepository
from vault_backend.schemas import TraceSubmission, TruthTableSubmission
from vault_backend.sync import payload_hash

pytestmark = pytest.mark.postgres
ORIGIN = "http://localhost:5173"


class PrivateDatabaseURL(str):
    def __repr__(self):
        return "<private disposable PostgreSQL connection>"


def urls():
    owner = os.environ.get("VAULT_TEST_DATABASE_URL", "")
    api = os.environ.get("VAULT_TEST_API_DATABASE_URL", "")
    if not owner or not api:
        pytest.skip("Requires explicitly disposable PostgreSQL with separate API role")
    if os.environ.get("VAULT_TEST_DATABASE_IS_DISPOSABLE") != "1":
        raise pytest.UsageError("Sync PostgreSQL tests require a disposable database")
    return PrivateDatabaseURL(owner.replace("postgresql+psycopg://", "postgresql://", 1)), api


@pytest.fixture
async def cloud(tmp_path):
    owner_url, api_url = urls()
    with psycopg.connect(owner_url) as conn:
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "0009_structured_attempt"
        )
    settings = Settings(
        environment="test",
        database_url=api_url,
        auth_enabled=True,
        mail_capture_dir=tmp_path / "private-mail",
    )
    app = create_app(settings)
    clients = []

    def seed(account_type="student", account_id=None):
        account_id = account_id or uuid4()
        token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        with psycopg.connect(owner_url) as conn:
            if conn.execute("SELECT id FROM account WHERE id=%s", (account_id,)).fetchone() is None:
                email = f"sync-{account_id}@invalid.test"
                conn.execute(
                    "INSERT INTO account "
                    "(id,account_type,email_normalized,email_display,password_hash) "
                    "VALUES (%s,%s,%s,%s,'synthetic-not-a-password')",
                    (account_id, account_type, email, email),
                )
                conn.execute(
                    "INSERT INTO account_auth_state (account_id,email_verified_at) VALUES (%s,%s)",
                    (account_id, now),
                )
                conn.execute(
                    f"INSERT INTO {account_type}_profile (account_id,display_name) "
                    "VALUES (%s,'synthetic sync user')",
                    (account_id,),
                )
            conn.execute(
                "INSERT INTO auth_session "
                "(id,account_id,token_digest,csrf_digest,auth_revision,created_at,last_seen_at,"
                "idle_expires_at,absolute_expires_at) VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                (
                    uuid4(),
                    account_id,
                    digest(token),
                    digest(csrf_for(token)),
                    now,
                    now,
                    now + timedelta(hours=1),
                    now + timedelta(days=1),
                ),
            )
        client = AsyncClient(
            transport=ASGITransport(app=app),
            base_url=ORIGIN,
            headers={"Origin": ORIGIN, "X-CSRF-Token": csrf_for(token)},
            cookies={SESSION_COOKIE: token},
        )
        clients.append(client)
        return client, account_id

    yield app, seed, owner_url
    for client in clients:
        await client.aclose()
    await app.state.engine.dispose()


def claim_body(owner, origin=None, claim_id=None):
    return {
        "claim_id": str(claim_id or uuid4()),
        "expected_account_id": str(owner),
        "origin_local_space_id": str(origin or uuid4()),
        "manifest_hash": "1" * 64,
    }


async def claim(client, owner, origin=None):
    body = claim_body(owner, origin)
    response = await client.post(
        "/api/v1/sync/claims",
        json=body,
        headers={"Idempotency-Key": body["claim_id"]},
    )
    assert response.status_code == 200, response.text
    return response.json(), body


def draft(origin, explanation="本机原稿", updated="2026-10-05T12:00:00Z"):
    return {
        "id": "CS03-STACK-01",
        "spaceId": str(origin),
        "goal": "理解栈并推演状态",
        "goalConfirmed": True,
        "trace": [{"stack": "", "output": "", "underflow": False} for _ in range(7)],
        "explanation": explanation,
        "code": "print('本机代码')\n",
        "updatedAt": updated,
    }


def operation(kind, key, payload, base="0", op_id=None):
    return {
        "op_id": str(op_id or uuid4()),
        "object_type": kind,
        "object_id": str(key),
        "base_version": base,
        "payload_hash": payload_hash(payload),
        "payload": payload,
    }


async def batch(client, owner, space_id, ops, batch_id=None):
    body = {
        "expected_account_id": str(owner),
        "batch_id": str(batch_id or uuid4()),
        "operations": ops,
    }
    response = await client.post(
        f"/api/v1/sync/spaces/{space_id}/batches",
        json=body,
        headers={"Idempotency-Key": body["batch_id"]},
    )
    return response, body


async def test_claim_commit_response_lost_and_owner_recovery(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    b, bid = seed()
    body = claim_body(aid)
    # The first committed HTTP response is intentionally not used to bind local state.
    discarded = await a.post(
        "/api/v1/sync/claims", json=body, headers={"Idempotency-Key": body["claim_id"]}
    )
    assert discarded.status_code == 200
    denied = await b.get(f"/api/v1/sync/claims/{body['claim_id']}")
    assert denied.status_code == 404
    switched = await b.post(
        "/api/v1/sync/claims", json=body, headers={"Idempotency-Key": body["claim_id"]}
    )
    assert switched.status_code == 409 and switched.json()["code"] == "ACCOUNT_CHANGED"
    hijack = {**body, "claim_id": str(uuid4()), "expected_account_id": str(bid)}
    forbidden = await b.post(
        "/api/v1/sync/claims", json=hijack, headers={"Idempotency-Key": hijack["claim_id"]}
    )
    assert forbidden.status_code == 409 and forbidden.json()["code"] == "ORIGIN_UNAVAILABLE"
    restored, _ = seed(account_id=aid)
    recovered = await restored.get(f"/api/v1/sync/claims/{body['claim_id']}")
    assert recovered.status_code == 200
    retried = await restored.post(
        "/api/v1/sync/claims", json=body, headers={"Idempotency-Key": body["claim_id"]}
    )
    assert retried.json() == recovered.json()
    assert (await b.get("/api/v1/sync/spaces")).json() == {"spaces": []}


async def test_claim_fixed_manifest_and_repeated_same_origin(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    committed, original = await claim(a, aid)
    altered = {**original, "manifest_hash": "2" * 64}
    bad = await a.post(
        "/api/v1/sync/claims",
        json=altered,
        headers={"Idempotency-Key": original["claim_id"]},
    )
    assert bad.status_code == 409 and bad.json()["code"] == "IDEMPOTENCY_CONFLICT"
    other, body = await claim(a, aid, original["origin_local_space_id"])
    assert other["server_space_id"] == committed["server_space_id"]
    assert other["claim_id"] == body["claim_id"] != original["claim_id"]
    assert (await a.get(f"/api/v1/sync/claims/{body['claim_id']}")).json() == other
    assert len((await a.get("/api/v1/sync/spaces")).json()["spaces"]) == 1


async def test_claim_same_key_cannot_belong_to_another_account(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    b, bid = seed()
    _, first = await claim(a, aid)
    other = claim_body(bid, claim_id=UUID(first["claim_id"]))
    bad = await b.post(
        "/api/v1/sync/claims", json=other, headers={"Idempotency-Key": other["claim_id"]}
    )
    assert bad.status_code == 409
    # The failed claim transaction also rolls back its newly-created learning space.
    assert (await b.get("/api/v1/sync/spaces")).json() == {"spaces": []}


async def test_concurrent_cross_account_claim_has_one_owner(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    b, bid = seed()
    origin = uuid4()
    bodies = [claim_body(aid, origin), claim_body(bid, origin)]
    results = await asyncio.gather(
        *[
            client.post(
                "/api/v1/sync/claims", json=body, headers={"Idempotency-Key": body["claim_id"]}
            )
            for client, body in zip([a, b], bodies, strict=True)
        ]
    )
    assert sorted(result.status_code for result in results) == [200, 409]
    space_lists = await asyncio.gather(a.get("/api/v1/sync/spaces"), b.get("/api/v1/sync/spaces"))
    assert sum(len(response.json()["spaces"]) for response in space_lists) == 1


async def test_sync_requires_current_session_origin_csrf_and_account(cloud):
    app, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    origin, sid = mapping["origin_local_space_id"], mapping["server_space_id"]
    op = operation("draft", "CS03-STACK-01", draft(origin))
    async with AsyncClient(transport=ASGITransport(app=app), base_url=ORIGIN) as anonymous:
        body = {"expected_account_id": str(aid), "batch_id": str(uuid4()), "operations": [op]}
        response = await anonymous.post(
            f"/api/v1/sync/spaces/{sid}/batches",
            json=body,
            headers={"Origin": ORIGIN, "Idempotency-Key": body["batch_id"]},
        )
        assert response.status_code == 401
    body = {"expected_account_id": str(aid), "batch_id": str(uuid4()), "operations": [op]}
    path = f"/api/v1/sync/spaces/{sid}/batches"
    invalid_csrf = await a.post(
        path,
        json=body,
        headers={
            "Idempotency-Key": body["batch_id"],
            "X-CSRF-Token": "wrong",
        },
    )
    assert invalid_csrf.status_code == 403
    invalid_origin = await a.post(
        path,
        json=body,
        headers={
            "Idempotency-Key": body["batch_id"],
            "Origin": "https://evil.invalid",
        },
    )
    assert invalid_origin.status_code == 403
    changed, _ = await batch(a, uuid4(), sid, [op])
    assert changed.status_code == 409 and changed.json()["code"] == "ACCOUNT_CHANGED"
    b, bid = seed()
    private, _ = await batch(b, bid, sid, [op])
    assert private.status_code == 404
    assert (await b.get(f"/api/v1/sync/spaces/{sid}/changes")).status_code == 404


async def test_batch_response_lost_and_op_retry_are_durable(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    op = operation("draft", "CS03-STACK-01", draft(origin))
    first, body = await batch(a, aid, sid, [op])
    assert first.status_code == 200 and first.json()["results"][0]["status"] == "applied"
    retry, _ = await batch(a, aid, sid, [op], body["batch_id"])
    assert retry.json()["results"][0]["status"] == "already_applied"
    new_batch, _ = await batch(a, aid, sid, [op])
    assert new_batch.json()["results"][0]["status"] == "already_applied"
    changes = (await a.get(f"/api/v1/sync/spaces/{sid}/changes")).json()
    assert len(changes["changes"]) == 1 and changes["changes"][0]["version"] == "1"
    changed = operation("draft", "CS03-STACK-01", draft(origin, "修改过"), op_id=op["op_id"])
    mismatch, _ = await batch(a, aid, sid, [changed], body["batch_id"])
    assert mismatch.status_code == 409
    mismatch_op, _ = await batch(a, aid, sid, [changed])
    assert mismatch_op.json()["results"][0]["reason"] == "OP_IDEMPOTENCY_CONFLICT"


async def test_multidevice_conflict_preserves_both_branches_and_no_clock_lww(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    device2, _ = seed(account_id=aid)
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    initial, _ = await batch(a, aid, sid, [operation("draft", "CS03-STACK-01", draft(origin))])
    assert initial.status_code == 200
    op_a = operation("draft", "CS03-STACK-01", draft(origin, "设备A", "2099-01-01T00:00:00Z"), "1")
    op_b = operation("draft", "CS03-STACK-01", draft(origin, "设备B", "2000-01-01T00:00:00Z"), "1")
    results = await asyncio.gather(batch(a, aid, sid, [op_a]), batch(device2, aid, sid, [op_b]))
    rows = [response.json()["results"][0] for response, _ in results]
    assert sorted(row["status"] for row in rows) == ["applied", "conflict"]
    assert all(row["current_version"] == "2" for row in rows)
    conflict_index = next(index for index, row in enumerate(rows) if row["status"] == "conflict")
    branches = (await a.get(f"/api/v1/sync/spaces/{sid}/conflicts")).json()["conflicts"]
    assert len(branches) == 1
    assert branches[0]["incoming_payload"] == [op_a, op_b][conflict_index]["payload"]
    changed = (await a.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    assert len(changed) == 2
    assert changed[-1]["payload"] == [op_a, op_b][1 - conflict_index]["payload"]
    explicit = operation("draft", "CS03-STACK-01", draft(origin, "本人确认合并"), "2")
    resolved, _ = await batch(a, aid, sid, [explicit])
    assert resolved.json()["results"][0]["current_version"] == "3"
    assert len((await a.get(f"/api/v1/sync/spaces/{sid}/conflicts")).json()["conflicts"]) == 1


async def test_tombstone_cannot_be_resurrected_and_order_is_server_sequence(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    original = draft(origin)
    await batch(a, aid, sid, [operation("draft", original["id"], original)])
    deleted, _ = await batch(
        a, aid, sid, [operation("draft", original["id"], {"deleted": True}, "1")]
    )
    assert deleted.json()["results"][0]["current_version"] == "2"
    old, _ = await batch(a, aid, sid, [operation("draft", original["id"], original, "1")])
    latest, _ = await batch(a, aid, sid, [operation("draft", original["id"], original, "2")])
    assert old.json()["results"][0]["reason"] == "OBJECT_DELETED"
    assert latest.json()["results"][0]["reason"] == "OBJECT_DELETED"
    changes = (await a.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    assert [row["sequence"] for row in changes] == ["1", "2"]
    assert changes[-1]["deleted"] is True and changes[-1]["payload"] is None


async def test_payload_schema_hash_role_and_attachment_rejections_are_per_item(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    privileged = {**draft(origin), "role": "teacher", "trusted": True}
    wrong_space = draft(uuid4())
    wrong_hash = operation("draft", "CS03-STACK-01", draft(origin))
    wrong_hash["payload_hash"] = "0" * 64
    teacher = {
        "id": str(uuid4()),
        "spaceId": origin,
        "title": "私人备课",
        "outline": "原稿",
        "studentVisible": False,
        "updatedAt": "2026-10-05T12:00:00Z",
    }
    ops = [
        operation("draft", "CS03-STACK-01", privileged),
        operation("draft", "CS03-STACK-01", wrong_space),
        wrong_hash,
        operation("teacher_draft", teacher["id"], teacher),
        operation("attachment", str(uuid4()), {"file": "not-supported"}),
    ]
    response, _ = await batch(a, aid, sid, ops)
    assert response.status_code == 200
    assert [row["reason"] for row in response.json()["results"]] == [
        "INVALID_PAYLOAD",
        "SOURCE_SPACE_MISMATCH",
        "PAYLOAD_HASH_MISMATCH",
        "TEACHER_ACCOUNT_REQUIRED",
        "ATTACHMENT_UNSUPPORTED",
    ]
    assert all(row["status"] == "rejected" for row in response.json()["results"])
    assert (await a.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"] == []


async def test_teacher_private_drafts_remain_private_and_cannot_publish(cloud):
    _, seed, _ = cloud
    a, aid = seed("teacher")
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    teacher = {
        "id": str(uuid4()),
        "spaceId": origin,
        "title": "私人备课",
        "outline": "原稿",
        "studentVisible": False,
        "updatedAt": "2026-10-05T12:00:00Z",
    }
    response, _ = await batch(a, aid, sid, [operation("teacher_draft", teacher["id"], teacher)])
    assert response.json()["results"][0]["status"] == "applied"
    published = {**teacher, "studentVisible": True}
    denied, _ = await batch(
        a, aid, sid, [operation("teacher_draft", teacher["id"], published, "1")]
    )
    assert denied.json()["results"][0]["reason"] == "INVALID_PAYLOAD"
    b, _ = seed("student")
    assert (await b.get(f"/api/v1/sync/spaces/{sid}/changes")).status_code == 404


def personal_course(origin, course_id=None, topic_id=None):
    return {
        "id": str(course_id or uuid4()),
        "spaceId": str(origin),
        "title": "自定的计算机网络课程",
        "goal": "能解释路由选择并完成可复现的实验",
        "topics": [
            {
                "id": str(topic_id or uuid4()),
                "title": "路由选择",
                "expectedPerformance": "提交拓扑、路由表和结果解释",
            }
        ],
        "createdAt": "2026-10-05T12:00:00Z",
        "updatedAt": "2026-10-05T12:00:00Z",
    }


def personal_attempt(origin, course, scope_version_id=None):
    payload = {
        "id": str(uuid4()),
        "spaceId": str(origin),
        "courseId": course["id"],
        "topicId": course["topics"][0]["id"],
        "learningQuestion": "为什么默认路由没生效？",
        "theoryNote": "最长前缀匹配优先于默认路由。",
        "action": "构造两条静态路由并查看路由表。",
        "observation": "目标网段命中了更具体的路由。",
        "reflection": "原先的默认路由假设不适用于这个目标地址。",
        "nextStep": "修改目标网段后再次验证。",
        "createdAt": "2026-10-05T12:05:00Z",
    }
    if scope_version_id:
        payload["scopeVersionId"] = str(scope_version_id)
    return payload


def personal_course_scope_version(origin, course, version=1):
    gaps = []
    if not course["goal"].strip():
        gaps.append("goal")
    if not course["topics"]:
        gaps.append("learning_points")
    return {
        "id": str(uuid4()),
        "spaceId": str(origin),
        "courseId": course["id"],
        "version": version,
        "title": course["title"],
        "goal": course["goal"],
        "topics": course["topics"],
        "scopeStatus": "exploration" if gaps else "defined",
        "gaps": gaps,
        "confirmedAt": "2026-10-05T12:03:00Z",
    }


def personal_assist(origin, course, scope, attempt):
    return {
        "id": str(uuid4()),
        "spaceId": str(origin),
        "courseId": course["id"],
        "scopeVersionId": scope["id"],
        "topicId": course["topics"][0]["id"],
        "attemptId": attempt["id"],
        "intent": "practice",
        "question": "下一步怎么验证？",
        "reply": "改变目标网段再观察。",
        "nextAction": "记录修改后的路由表。",
        "modelProfileId": "local",
        "provider": "本人部署的模型",
        "disclosureVersion": "personal-learning-assist-v1",
        "createdAt": "2026-10-08T12:06:00Z",
    }


async def test_personal_assist_requires_matching_attempt_and_is_append_only(cloud):
    _, seed, owner_url = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    course = personal_course(origin)
    scope = personal_course_scope_version(origin, course)
    attempt = personal_attempt(origin, course, scope["id"])
    assist = personal_assist(origin, course, scope, attempt)
    missing, _ = await batch(
        student, account_id, sid, [operation("personal_assist", assist["id"], assist)]
    )
    assert missing.json()["results"][0]["reason"] == "PERSONAL_ATTEMPT_NOT_SYNCED"
    created, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_course", course["id"], course),
            operation("personal_course_version", scope["id"], scope),
            operation("personal_attempt", attempt["id"], attempt),
            operation("personal_assist", assist["id"], assist),
        ],
    )
    assert [row["status"] for row in created.json()["results"]] == ["applied"] * 4
    other = personal_assist(origin, course, scope, attempt)
    other["topicId"] = str(uuid4())
    rejected, _ = await batch(
        student, account_id, sid, [operation("personal_assist", other["id"], other)]
    )
    assert rejected.json()["results"][0]["reason"] == "PERSONAL_ASSIST_REFERENCE_MISMATCH"
    changed, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_assist", assist["id"], {**assist, "reply": "rewritten"}, "1"),
            operation("personal_assist", assist["id"], {"deleted": True}, "1"),
        ],
    )
    assert [row["reason"] for row in changed.json()["results"]] == [
        "IMMUTABLE_HISTORY",
        "PERSONAL_RECORD_DELETE_UNSUPPORTED",
    ]
    stranger, _ = seed("student")
    assert (await stranger.get(f"/api/v1/sync/spaces/{sid}/changes")).status_code == 404
    with psycopg.connect(owner_url) as conn:
        conn.execute("SET LOCAL ROLE vault_api")
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(account_id),))
        with pytest.raises(psycopg.errors.CheckViolation):
            with conn.transaction():
                conn.execute(
                    "UPDATE sync_object SET version=version+1,updated_at=now() "
                    "WHERE space_id=%s AND object_type='personal_assist' AND object_id=%s",
                    (sid, assist["id"]),
                )
        conn.rollback()


async def test_confirmed_personal_scope_is_immutable_and_attempts_reference_its_version(cloud):
    _, seed, _ = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    course = personal_course(origin)
    scope = personal_course_scope_version(origin, course)
    saved_course, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course", course["id"], course)],
    )
    assert saved_course.json()["results"][0]["status"] == "applied"

    attempt = {**personal_attempt(origin, course), "scopeVersionId": scope["id"]}
    missing_scope, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_attempt", attempt["id"], attempt)],
    )
    assert missing_scope.json()["results"][0]["reason"] == "PERSONAL_COURSE_VERSION_NOT_SYNCED"

    saved_scope, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course_version", scope["id"], scope)],
    )
    assert saved_scope.json()["results"][0]["status"] == "applied"
    duplicate_scope = personal_course_scope_version(origin, course)
    duplicate_result, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course_version", duplicate_scope["id"], duplicate_scope)],
    )
    assert duplicate_result.json()["results"][0]["reason"] == "PERSONAL_COURSE_VERSION_CONFLICT"
    saved_attempt, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_attempt", attempt["id"], attempt)],
    )
    assert saved_attempt.json()["results"][0]["status"] == "applied"

    rewritten_scope = {**scope, "goal": "事后改写的学习范围"}
    rewritten, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course_version", scope["id"], rewritten_scope, "1")],
    )
    assert rewritten.json()["results"][0]["reason"] == "IMMUTABLE_HISTORY"
    changes = (await student.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    scope_change = next(row for row in changes if row["object_type"] == "personal_course_version")
    attempt_change = next(row for row in changes if row["object_type"] == "personal_attempt")
    assert scope_change["payload"] == scope
    assert attempt_change["payload"]["scopeVersionId"] == scope["id"]


async def test_personal_course_and_attempt_claim_are_student_owned_reports(cloud):
    _, seed, _ = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    course = personal_course(origin)
    scope = personal_course_scope_version(origin, course)
    attempt = personal_attempt(origin, course, scope["id"])
    pending, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_attempt", attempt["id"], attempt)],
    )
    assert pending.json()["results"][0]["reason"] == "PERSONAL_COURSE_NOT_SYNCED"
    saved, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_course", course["id"], course),
            operation("personal_course_version", scope["id"], scope),
            operation("personal_attempt", attempt["id"], attempt),
        ],
    )
    assert [row["status"] for row in saved.json()["results"]] == ["applied", "applied", "applied"]
    changes = (await student.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    assert [row["object_type"] for row in changes] == [
        "personal_course",
        "personal_course_version",
        "personal_attempt",
    ]
    assert all(row["provenance"] == "client_reported" for row in changes)
    assert changes[2]["payload"] == attempt
    other_student, _ = seed("student")
    teacher, _ = seed("teacher")
    for client in (other_student, teacher):
        assert (await client.get(f"/api/v1/sync/spaces/{sid}/changes")).status_code == 404


async def test_named_personal_course_can_start_before_goal_and_topic_confirmation(cloud):
    _, seed, _ = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    detailed = personal_course(origin)
    named_only = {**detailed, "goal": "", "topics": []}
    created, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course", named_only["id"], named_only)],
    )
    assert created.json()["results"][0]["status"] == "applied"
    first_scope = personal_course_scope_version(origin, named_only)
    first_confirmed, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course_version", first_scope["id"], first_scope)],
    )
    assert first_confirmed.json()["results"][0]["status"] == "applied"
    attempt = personal_attempt(origin, detailed, first_scope["id"])
    too_early, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_attempt", attempt["id"], attempt)],
    )
    assert too_early.json()["results"][0]["reason"] == "PERSONAL_COURSE_VERSION_MISMATCH"
    confirmed = {**detailed, "updatedAt": "2026-10-05T12:03:00Z"}
    second_scope = personal_course_scope_version(origin, confirmed, 2)
    added, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_course", confirmed["id"], confirmed, "1"),
            operation("personal_course_version", second_scope["id"], second_scope),
            operation(
                "personal_attempt",
                attempt["id"],
                {**attempt, "scopeVersionId": second_scope["id"]},
            ),
        ],
    )
    assert [row["status"] for row in added.json()["results"]] == ["applied"] * 3


async def test_personal_learning_rejects_trust_forgery_and_invalid_references(cloud):
    _, seed, _ = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    course = personal_course(origin)
    duplicate = {**course, "topics": [course["topics"][0], course["topics"][0]]}
    invented_mastery = {**course, "mastered": True}
    wrong_space = {**course, "spaceId": str(uuid4())}
    invalid, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_course", course["id"], duplicate),
            operation("personal_course", course["id"], invented_mastery),
            operation("personal_course", course["id"], wrong_space),
            operation("personal_course", str(uuid4()), course),
        ],
    )
    assert [row["reason"] for row in invalid.json()["results"]] == [
        "INVALID_PAYLOAD",
        "INVALID_PAYLOAD",
        "SOURCE_SPACE_MISMATCH",
        "SOURCE_OBJECT_MISMATCH",
    ]
    saved, _ = await batch(
        student, account_id, sid, [operation("personal_course", course["id"], course)]
    )
    assert saved.json()["results"][0]["status"] == "applied"
    scope = personal_course_scope_version(origin, course)
    saved_scope, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_course_version", scope["id"], scope)],
    )
    assert saved_scope.json()["results"][0]["status"] == "applied"
    unscoped_attempt = personal_attempt(origin, course)
    unscoped, _ = await batch(
        student,
        account_id,
        sid,
        [operation("personal_attempt", unscoped_attempt["id"], unscoped_attempt)],
    )
    assert unscoped.json()["results"][0]["reason"] == "PERSONAL_COURSE_VERSION_REQUIRED"
    attempt = personal_attempt(origin, course, scope["id"])
    wrong_topic = {**attempt, "topicId": str(uuid4())}
    fake_verification = {**attempt, "verified": True}
    denied, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_attempt", attempt["id"], wrong_topic),
            operation("personal_attempt", attempt["id"], fake_verification),
        ],
    )
    assert [row["reason"] for row in denied.json()["results"]] == [
        "PERSONAL_COURSE_VERSION_MISMATCH",
        "INVALID_PAYLOAD",
    ]
    teacher, teacher_id = seed("teacher")
    teacher_mapping, _ = await claim(teacher, teacher_id)
    foreign = personal_course(teacher_mapping["origin_local_space_id"])
    teacher_saved, _ = await batch(
        teacher,
        teacher_id,
        teacher_mapping["server_space_id"],
        [operation("personal_course", foreign["id"], foreign)],
    )
    assert teacher_saved.json()["results"][0]["status"] == "applied"
    teacher_changes = (
        await teacher.get(f"/api/v1/sync/spaces/{teacher_mapping['server_space_id']}/changes")
    ).json()["changes"]
    assert teacher_changes[0]["payload"] == foreign
    assert teacher_changes[0]["provenance"] == "client_reported"
    private_read = await student.get(
        f"/api/v1/sync/spaces/{teacher_mapping['server_space_id']}/changes"
    )
    assert private_read.status_code == 404


async def test_personal_attempt_history_and_course_topic_identity_are_preserved(cloud):
    _, seed, owner_url = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    course = personal_course(origin)
    scope = personal_course_scope_version(origin, course)
    attempt = personal_attempt(origin, course, scope["id"])
    applied, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_course", course["id"], course),
            operation("personal_course_version", scope["id"], scope),
            operation("personal_attempt", attempt["id"], attempt),
        ],
    )
    assert [row["status"] for row in applied.json()["results"]] == ["applied", "applied", "applied"]
    rewritten = {**attempt, "observation": "事后改写"}
    removed_topic = {**course, "topics": [{**course["topics"][0], "id": str(uuid4())}]}
    rewritten_topic = {
        **course,
        "topics": [{**course["topics"][0], "expectedPerformance": "改写原有判定标准"}],
    }
    results, _ = await batch(
        student,
        account_id,
        sid,
        [
            operation("personal_attempt", attempt["id"], rewritten, "1"),
            operation("personal_course", course["id"], removed_topic, "1"),
            operation("personal_course", course["id"], rewritten_topic, "1"),
            operation("personal_attempt", attempt["id"], {"deleted": True}, "1"),
        ],
    )
    assert [row["reason"] for row in results.json()["results"]] == [
        "IMMUTABLE_HISTORY",
        "PERSONAL_COURSE_IDENTITY_MISMATCH",
        "PERSONAL_COURSE_IDENTITY_MISMATCH",
        "PERSONAL_RECORD_DELETE_UNSUPPORTED",
    ]
    assert len((await student.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]) == 3
    with psycopg.connect(owner_url) as conn:
        conn.execute("SET LOCAL ROLE vault_api")
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(account_id),))
        with pytest.raises(psycopg.errors.CheckViolation):
            with conn.transaction():
                conn.execute(
                    "UPDATE sync_object SET version=version+1,updated_at=now() "
                    "WHERE space_id=%s AND object_type='personal_attempt' AND object_id=%s",
                    (sid, attempt["id"]),
                )
        conn.rollback()
        with pytest.raises(psycopg.errors.CheckViolation):
            with conn.transaction():
                conn.execute(
                    "UPDATE sync_object SET version=version+1,deleted_at=now(),updated_at=now() "
                    "WHERE space_id=%s AND object_type='personal_course_version' AND object_id=%s",
                    (sid, scope["id"]),
                )
        conn.rollback()


def evidence_bundle(origin, trace_payload):
    revision_id, artifact_id = str(uuid4()), str(uuid4())
    submission = TraceSubmission.model_validate(
        {
            **trace_payload,
            "client_revision_id": revision_id,
            "client_artifact_id": artifact_id,
        }
    )
    revision = {
        **draft(origin, submission.explanation),
        "artifactId": artifact_id,
        "revisionId": revision_id,
        "version": "1",
        "trace": [
            {
                "stack": json.dumps(row.after_stack),
                "output": "" if row.output is None else str(row.output),
                "underflow": row.underflow,
            }
            for row in submission.trace
        ],
    }
    result = verify_trace(submission)
    result["verification_id"] = str(uuid4())
    result.update(CourseRepository(Settings().course_catalog_path).trace_context)
    evidence = {
        "id": str(uuid4()),
        "spaceId": str(origin),
        "objectiveId": revision["id"],
        "revisionId": revision_id,
        "revisionVersion": "1",
        "submittedAt": "2026-10-05T12:00:00Z",
        "createdAt": "2026-10-05T12:00:01Z",
        "submittedWork": {
            "trace": [row.model_dump(mode="json") for row in submission.trace],
            "explanation": submission.explanation,
        },
        "result": result,
        "helpEventIds": [],
    }
    return revision, evidence


async def test_course_attempt_draft_can_finish_once_and_cloud_copy_requires_review(cloud):
    _, seed, owner_url = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    stamp = "2026-10-08T12:00:00Z"
    attempt = {
        "id": str(uuid4()), "spaceId": origin, "artifactId": str(uuid4()),
        "objectiveId": "CS05-LOGIC-01", "courseCode": "CS05",
        "activityVersion": "CS05-LOGIC-01-TABLE@0.1.0",
        "rows": [
            {"implication": True, "contrapositive": True, "biconditional": True},
            {"implication": True, "contrapositive": True, "biconditional": False},
            {"implication": False, "contrapositive": False, "biconditional": False},
            {"implication": True, "contrapositive": True, "biconditional": True},
        ],
        "explanation": "P 真 Q 假时蕴含为假。",
        "result": None, "createdAt": stamp, "updatedAt": stamp,
    }
    saved, _ = await batch(
        student, account_id, sid, [operation("course_attempt", attempt["id"], attempt)]
    )
    assert saved.json()["results"][0]["status"] == "applied", saved.text
    context = CourseRepository(
        Settings(environment="test", database_url="").course_catalog_path
    ).logic_context
    assert context is not None
    submission = TruthTableSubmission.model_validate({
        "kind": "verify_truth_table", "course_code": "CS05",
        "activity_version": attempt["activityVersion"],
        "standard_version": "propositional-table-v1",
        "client_artifact_id": attempt["artifactId"], "client_revision_id": attempt["id"],
        "rows": attempt["rows"], "explanation": attempt["explanation"],
    })
    result = {**verify_truth_table(submission), **context, "verification_id": str(uuid4())}
    completed = {**attempt, "submittedAt": stamp, "result": result}
    finished, _ = await batch(
        student, account_id, sid, [operation("course_attempt", attempt["id"], completed, "1")]
    )
    assert finished.json()["results"][0]["status"] == "applied", finished.text
    changed = {**completed, "explanation": "事后更改作品"}
    forged = {**completed, "resultTrust": "server_verified"}
    denied, _ = await batch(student, account_id, sid, [
        operation("course_attempt", attempt["id"], changed, "2"),
        operation("course_attempt", attempt["id"], forged, "2"),
    ])
    assert [item["reason"] for item in denied.json()["results"]] == [
        "COURSE_ATTEMPT_LOCKED", "INVALID_PAYLOAD"
    ]
    changes = (await student.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    assert changes[-1]["object_type"] == "course_attempt"
    assert changes[-1]["requires_review"] is True
    assert changes[-1]["provenance"] == "client_reported"
    with psycopg.connect(owner_url) as conn:
        conn.execute("SET LOCAL ROLE vault_api")
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(account_id),))
        with pytest.raises(psycopg.errors.CheckViolation):
            with conn.transaction():
                conn.execute(
                    "UPDATE sync_object SET version=version+1,updated_at=now() "
                    "WHERE space_id=%s AND object_type='course_attempt' AND object_id=%s",
                    (sid, attempt["id"]),
                )


async def test_imported_guest_evidence_pending_dependencies_never_become_platform_trust(
    cloud, trace_payload
):
    _, seed, owner_url = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    revision, evidence = evidence_bundle(origin, trace_payload)
    op = operation("evidence", evidence["id"], evidence)
    pending, old_batch = await batch(a, aid, sid, [op])
    assert pending.json()["results"][0]["status"] == "dependency_pending"
    uploaded, _ = await batch(
        a, aid, sid, [operation("revision", revision["revisionId"], revision)]
    )
    assert uploaded.json()["results"][0]["status"] == "applied"
    old_retry, _ = await batch(a, aid, sid, [op], old_batch["batch_id"])
    assert old_retry.json()["results"][0]["status"] == "dependency_pending"
    retry, _ = await batch(a, aid, sid, [op])
    assert retry.json()["results"][0]["status"] == "applied"
    changes = (await a.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    imported = changes[-1]
    assert imported["provenance"] == "client_reported" and imported["requires_review"] is True
    assert imported["payload"]["result"] == evidence["result"]
    with psycopg.connect(owner_url) as conn:
        assert (
            conn.execute(
                "SELECT count(*) FROM verification_event WHERE space_id=%s", (sid,)
            ).fetchone()[0]
            == 0
        )


async def test_evidence_hash_revision_and_privilege_forgery_rejected(cloud, trace_payload):
    _, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    revision, evidence = evidence_bundle(origin, trace_payload)
    await batch(a, aid, sid, [operation("revision", revision["revisionId"], revision)])
    forged = copy.deepcopy(evidence)
    forged["id"] = str(uuid4())
    forged["result"]["mastery_asserted"] = True
    wrong_hash = copy.deepcopy(evidence)
    wrong_hash["id"] = str(uuid4())
    wrong_hash["result"]["artifact_hash"] = "0" * 64
    wrong_revision = copy.deepcopy(evidence)
    wrong_revision["id"] = str(uuid4())
    wrong_revision["result"]["client_artifact_id"] = str(uuid4())
    response, _ = await batch(
        a,
        aid,
        sid,
        [operation("evidence", item["id"], item) for item in [forged, wrong_hash, wrong_revision]],
    )
    assert [row["reason"] for row in response.json()["results"]] == [
        "INVALID_PAYLOAD",
        "EVIDENCE_CONTENT_MISMATCH",
        "EVIDENCE_REVISION_MISMATCH",
    ]


async def test_immutable_revision_and_same_space_help_dependencies(cloud, trace_payload):
    _, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    revision, evidence = evidence_bundle(origin, trace_payload)
    help_record = {
        "id": str(uuid4()),
        "spaceId": origin,
        "objectiveId": "CS03-STACK-01",
        "kind": "answer",
        "disclosureVersion": "stack-answer-v1",
        "createdAt": "2026-10-05T11:00:00Z",
    }
    evidence["helpEventIds"] = [help_record["id"]]
    await batch(a, aid, sid, [operation("revision", revision["revisionId"], revision)])
    changed = {**revision, "explanation": "历史不能修改"}
    denied, _ = await batch(
        a, aid, sid, [operation("revision", revision["revisionId"], changed, "1")]
    )
    assert denied.json()["results"][0]["reason"] == "IMMUTABLE_HISTORY"
    pending, _ = await batch(a, aid, sid, [operation("evidence", evidence["id"], evidence)])
    assert pending.json()["results"][0]["reason"] == "HELP_NOT_SYNCED"
    applied, _ = await batch(
        a,
        aid,
        sid,
        [
            operation("help", help_record["id"], help_record),
            operation("evidence", evidence["id"], evidence),
        ],
    )
    assert [row["status"] for row in applied.json()["results"]] == ["applied", "applied"]


async def test_cursor_scope_page_replay_and_empty_poll_do_not_grow_rows(cloud):
    _, seed, owner_url = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    other, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    op1 = operation("draft", "CS03-STACK-01", draft(origin))
    op2 = operation("draft", "CS03-STACK-02", {**draft(origin), "id": "CS03-STACK-02"})
    await batch(a, aid, sid, [op1, op2])
    path = f"/api/v1/sync/spaces/{sid}/changes"
    page1 = (await a.get(path, params={"limit": 1})).json()
    assert page1["has_more"] and len(page1["changes"]) == 1
    page2 = (await a.get(path, params={"cursor": page1["next_cursor"], "limit": 1})).json()
    assert not page2["has_more"] and page2["changes"][0]["sequence"] == "2"
    replay = (await a.get(path, params={"cursor": page1["next_cursor"], "limit": 1})).json()
    assert replay == page2
    cross = await a.get(
        f"/api/v1/sync/spaces/{other['server_space_id']}/changes",
        params={"cursor": page1["next_cursor"]},
    )
    assert cross.status_code == 400 and cross.json()["code"] == "SYNC_CURSOR_INVALID"
    tampered = await a.get(path, params={"cursor": secrets.token_urlsafe(32)})
    assert tampered.status_code == 400
    for _ in range(4):
        empty = (await a.get(path, params={"cursor": page2["next_cursor"]})).json()
        assert empty["changes"] == [] and empty["next_cursor"] == page2["next_cursor"]
        # Fresh device requests the same terminal watermark, reusing its opaque token.
        fresh = (await a.get(path)).json()
        assert fresh["next_cursor"] == page2["next_cursor"]
    with psycopg.connect(owner_url) as conn:
        assert (
            conn.execute("SELECT count(*) FROM sync_cursor WHERE space_id=%s", (sid,)).fetchone()[0]
            == 2
        )
        hashes = conn.execute(
            "SELECT token_digest,token_value FROM sync_cursor WHERE space_id=%s", (sid,)
        ).fetchall()
        assert all(value == hashlib.sha256(token.encode()).digest() for value, token in hashes)


async def test_sync_database_rls_pool_context_and_cross_space_constraints(cloud):
    _, seed, owner_url = cloud
    a, aid = seed()
    b, bid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    await batch(a, aid, sid, [operation("draft", "CS03-STACK-01", draft(origin))])
    with psycopg.connect(owner_url) as conn:
        conn.execute("SET LOCAL ROLE vault_api")
        assert conn.execute(
            "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"
        ).fetchone() == (False, False)
        assert conn.execute("SELECT count(*) FROM sync_object").fetchone()[0] == 0
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(bid),))
        assert (
            conn.execute("SELECT count(*) FROM sync_object WHERE space_id=%s", (sid,)).fetchone()[0]
            == 0
        )
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(aid),))
        assert (
            conn.execute("SELECT count(*) FROM sync_object WHERE space_id=%s", (sid,)).fetchone()[0]
            == 1
        )
        conn.rollback()
    # Repeated authenticated reads alternate pool connections without exposing A to B.
    assert len((await a.get("/api/v1/sync/spaces")).json()["spaces"]) == 1
    assert (await b.get("/api/v1/sync/spaces")).json()["spaces"] == []


async def test_revoked_session_cannot_upload_after_logout(cloud):
    _, seed, _ = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    old_cookie = a.cookies.get(SESSION_COOKIE)
    logout = await a.post("/api/v1/auth/logout")
    assert logout.status_code in {200, 204}
    a.cookies.set(SESSION_COOKIE, old_cookie)
    response, _ = await batch(
        a,
        aid,
        mapping["server_space_id"],
        [operation("draft", "CS03-STACK-01", draft(mapping["origin_local_space_id"]))],
    )
    assert response.status_code == 401


async def test_database_null_payload_cannot_bypass_object_or_change_shape(cloud):
    _, seed, owner_url = cloud
    a, aid = seed()
    mapping, _ = await claim(a, aid)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    applied, _ = await batch(a, aid, sid, [operation("draft", "CS03-STACK-01", draft(origin))])
    assert applied.status_code == 200
    with psycopg.connect(owner_url) as conn:
        conn.execute("SET LOCAL ROLE vault_api")
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(aid),))
        with pytest.raises(psycopg.errors.CheckViolation) as invalid_object:
            with conn.transaction():
                conn.execute(
                    "INSERT INTO sync_object "
                    "(space_id,object_type,object_id,server_object_id,version,"
                    "payload_hash,payload) "
                    "VALUES (%s,'draft','CS03-STACK-02',%s,1,%s,NULL)",
                    (sid, uuid4(), bytes(32)),
                )
        assert invalid_object.value.diag.constraint_name == "ck_sync_object_payload"
        server_id = conn.execute(
            "SELECT server_object_id FROM sync_object "
            "WHERE space_id=%s AND object_type='draft' AND object_id='CS03-STACK-01'",
            (sid,),
        ).fetchone()[0]
        with pytest.raises(psycopg.errors.CheckViolation) as invalid_change:
            with conn.transaction():
                conn.execute(
                    "INSERT INTO sync_change "
                    "(space_id,sequence,object_type,object_id,server_object_id,version,"
                    "payload_hash,payload,deleted) "
                    "VALUES (%s,2,'draft','CS03-STACK-01',%s,2,%s,NULL,false)",
                    (sid, server_id, bytes(32)),
                )
        assert invalid_change.value.diag.constraint_name == "ck_sync_change_payload"
        conn.rollback()


async def test_structured_attempt_submit_restore_and_history_lock(cloud):
    from vault_backend.course_checks.structured_trace import get_trace_spec, verify_structured_trace

    _, seed, owner_url = cloud
    student, account_id = seed("student")
    mapping, _ = await claim(student, account_id)
    sid, origin = mapping["server_space_id"], mapping["origin_local_space_id"]
    spec = get_trace_spec("CS03-STACK-U01-TRACE@0.1.0")
    stamp = "2026-10-09T12:00:00Z"
    attempt = {
        "id": str(uuid4()), "spaceId": origin, "artifactId": str(uuid4()),
        "objectiveCode": "CS03-STACK-01", "courseCode": "CS03",
        "activityVersion": spec.activity_version, "kind": "structured_trace",
        "traceRows": [{"state": {"items": json.dumps(step["state"]["items"])},
                       "value": "" if step["value"] is None else str(step["value"]),
                       "status": step["status"]} for step in spec.expected_submission_steps()],
        "bracketRows": [], "explanation": "Last in, first out.",
        "result": None, "createdAt": stamp, "updatedAt": stamp,
    }
    saved, _ = await batch(student, account_id, sid, [operation("structured_attempt", attempt["id"], attempt)])
    assert saved.json()["results"][0]["status"] == "applied", saved.text
    frozen = {**attempt, "submittedAt": stamp}
    submitted, _ = await batch(student, account_id, sid, [operation("structured_attempt", attempt["id"], frozen, "1")])
    assert submitted.json()["results"][0]["status"] == "applied", submitted.text
    denied, _ = await batch(student, account_id, sid, [operation("structured_attempt", attempt["id"], {**frozen, "explanation": "changed"}, "2")])
    assert denied.json()["results"][0]["reason"] == "COURSE_ATTEMPT_LOCKED"
    result = verify_structured_trace({
        "client_artifact_id": attempt["artifactId"], "client_revision_id": attempt["id"],
        "explanation": attempt["explanation"], "steps": spec.expected_submission_steps(),
    }, spec)
    result.update(spec.context)
    result["verification_id"] = str(uuid4())
    completed = {**frozen, "result": result}
    finished, _ = await batch(student, account_id, sid, [operation("structured_attempt", attempt["id"], completed, "2")])
    assert finished.json()["results"][0]["status"] == "applied", finished.text
    changes = (await student.get(f"/api/v1/sync/spaces/{sid}/changes")).json()["changes"]
    assert changes[-1]["object_type"] == "structured_attempt"
    assert changes[-1]["requires_review"] is True
    assert changes[-1]["provenance"] == "client_reported"
    with psycopg.connect(owner_url) as conn:
        conn.execute("SET LOCAL ROLE vault_api")
        conn.execute("SELECT set_config('vault.account_id',%s,true)", (str(account_id),))
        with pytest.raises(psycopg.errors.CheckViolation):
            with conn.transaction():
                conn.execute("UPDATE sync_object SET version=version+1 WHERE space_id=%s AND object_type='structured_attempt' AND object_id=%s", (sid, attempt["id"]))
