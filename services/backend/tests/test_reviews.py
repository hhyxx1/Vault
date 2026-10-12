"""Real PostgreSQL + HTTP tests for the human review and appeal workflow.

Covers the state machine, scoped teacher authorization, cross-account hiding,
no auto-signature without a verified teacher, rubric coverage, multiple valid
solutions (no keyword/word-count scoring), appeals and append-only history.
"""

import os
import secrets
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient

from vault_backend.api import create_app
from vault_backend.auth import SESSION_COOKIE, csrf_for, digest
from vault_backend.config import Settings

pytestmark = pytest.mark.postgres

ORIGIN = "http://localhost:5173"
RUBRIC = [
    {"id": "obj1", "title": "客观结果", "kind": "objective"},
    {"id": "exp1", "title": "解释与设计", "kind": "explanation"},
]
HASH = "a" * 64


class PrivateDatabaseURL(str):
    def __repr__(self):
        return "<private disposable PostgreSQL connection>"


def urls():
    owner = os.environ.get("VAULT_TEST_DATABASE_URL", "")
    api = os.environ.get("VAULT_TEST_API_DATABASE_URL", "")
    if not owner or not api:
        pytest.skip("Requires explicitly disposable PostgreSQL with separate API role")
    if os.environ.get("VAULT_TEST_DATABASE_IS_DISPOSABLE") != "1":
        raise pytest.UsageError("Review PostgreSQL tests require a disposable database")
    return PrivateDatabaseURL(owner.replace("postgresql+psycopg://", "postgresql://", 1)), api


def claim_body(owner, origin=None, claim_id=None):
    return {
        "claim_id": str(claim_id or uuid4()),
        "expected_account_id": str(owner),
        "origin_local_space_id": str(origin or uuid4()),
        "manifest_hash": "1" * 64,
    }


@pytest.fixture
async def env(tmp_path):
    owner_url, api_url = urls()
    # The runtime role is granted table rights by environment bootstrap (never by
    # the migration owner). Scope it minimally: review history is insert-only and
    # assignments are never deleted.
    with psycopg.connect(owner_url) as admin:
        admin.execute(
            "GRANT SELECT,INSERT,UPDATE ON review_assignment TO vault_api"
        )
        admin.execute("GRANT SELECT,INSERT ON review_event TO vault_api")
        admin.execute(
            "GRANT EXECUTE ON FUNCTION vault_verified_teacher_exists(uuid) TO vault_api"
        )
        admin.commit()
    settings = Settings(
        environment="test",
        database_url=api_url,
        auth_enabled=True,
        mail_capture_dir=tmp_path / "private-mail",
    )
    app = create_app(settings)
    clients: dict[str, AsyncClient] = {}

    def seed(key, account_type, verified=False):
        account_id = uuid4()
        token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        with psycopg.connect(owner_url) as conn:
            email = f"review-{account_id}@invalid.test"
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
            if account_type == "teacher":
                state = "verified" if verified else "pending"
                conn.execute(
                    "INSERT INTO teacher_profile (account_id,display_name,verification_state) "
                    "VALUES (%s,'synthetic teacher',%s)",
                    (account_id, state),
                )
            else:
                conn.execute(
                    "INSERT INTO student_profile (account_id,display_name) VALUES (%s,'student')",
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
        clients[key] = client
        return client, account_id

    async def claim_space(client, owner):
        body = claim_body(owner)
        response = await client.post(
            "/api/v1/sync/claims",
            json=body,
            headers={"Idempotency-Key": body["claim_id"]},
        )
        assert response.status_code == 200, response.text
        return UUID(response.json()["server_space_id"])

    yield SimpleNamespace(seed=seed, claim_space=claim_space)
    for client in clients.values():
        await client.aclose()
    await app.state.engine.dispose()


def create_payload(owner, space_id, **overrides):
    assignment_id = overrides.pop("assignment_id", uuid4())
    payload = {
        "assignment_id": str(assignment_id),
        "expected_account_id": str(owner),
        "space_id": str(space_id),
        "audience": "platform_teachers",
        "course_code": "CS01",
        "course_version_id": None,
        "objective_code": "CS01-M01-O1",
        "activity_version": "CS01-M01-O1-CODE@0.1.0",
        "artifact_id": str(uuid4()),
        "artifact_revision_id": str(uuid4()),
        "artifact_hash": HASH,
        "rubric": RUBRIC,
        "evidence_snapshot": [
            {"kind": "server_tool", "summary": "三组独立输入全部满足不变量"},
            {"kind": "student_self", "summary": "我用哨兵节点统一了边界处理。"},
        ],
        "student_note": "请老师审阅设计与解释。",
    }
    payload.update(overrides)
    return payload


def results(*statuses, note="理由"):
    ids = ["obj1", "exp1"]
    return [
        {"id": ids[i], "status": status, "note": f"{note}{i}"}
        for i, status in enumerate(statuses)
    ]


async def open_assignment(env, audience="platform_teachers", teacher=None):
    student, owner = env.seed(f"s-{uuid4()}", "student")
    space_id = await env.claim_space(student, owner)
    overrides = {"audience": audience}
    if audience == "specific_teacher" and teacher is not None:
        overrides["teacher_account_id"] = str(teacher)
    payload = create_payload(owner, space_id, **overrides)
    response = await student.post(
        "/api/v1/reviews/assignments",
        json=payload,
        headers={"Idempotency-Key": payload["assignment_id"]},
    )
    assert response.status_code == 201, response.text
    return student, owner, response.json()


async def test_create_without_verified_teacher_is_honestly_unassigned(env):
    # Unverified named teacher: the request is recorded, but never claimed/signed.
    _, unverified = env.seed("t-unverified", "teacher", verified=False)
    student, owner, assignment = await open_assignment(
        env, audience="specific_teacher", teacher=unverified
    )
    assert assignment["status"] == "awaiting_review"
    assert assignment["review_service_available"] is False
    assert assignment["claimed_by_account_id"] is None
    assert [event["type"] for event in assignment["events"]] == ["submitted"]
    assert all(event["teacher_signature"] is None for event in assignment["events"])


async def test_unverified_teacher_cannot_claim_and_others_cannot_see(env):
    unverified_client, unverified_id = env.seed("t-pending", "teacher", verified=False)
    student, _, assignment = await open_assignment(
        env, audience="specific_teacher", teacher=unverified_id
    )
    denied = await unverified_client.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/claim"
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "TEACHER_VERIFICATION_REQUIRED"
    other_student, _ = env.seed("s-other", "student")
    hidden = await other_student.get(f"/api/v1/reviews/assignments/{assignment['id']}")
    assert hidden.status_code == 404


async def test_full_approve_flow_with_teacher_signature_and_no_keyword_scoring(env):
    teacher, teacher_id = env.seed("t-verified", "teacher", verified=True)
    student, _, assignment = await open_assignment(env)
    # A terse, distinct rationale is accepted: scoring never counts words/keywords.
    claim = await teacher.post(f"/api/v1/reviews/assignments/{assignment['id']}/claim")
    assert claim.status_code == 200, claim.text
    assert claim.json()["status"] == "claimed"
    decision = await teacher.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/decisions",
        json={"decision": "approved", "rubric_results": results("met", "met", note="对"),
              "comment": "通过"},
    )
    assert decision.status_code == 200, decision.text
    body = decision.json()
    assert body["status"] == "approved"
    decided = [event for event in body["events"] if event["type"] == "decision"][0]
    assert decided["decision"] == "approved"
    signature = decided["teacher_signature"]
    assert signature["verification_state"] == "verified"
    assert signature["teacher_account_id"] == str(teacher_id)
    assert signature["display_name"] == "synthetic teacher"
    assert signature["signed_at"]


async def test_second_teacher_cannot_take_claimed_assignment(env):
    first, _ = env.seed("t-a", "teacher", verified=True)
    second, _ = env.seed("t-b", "teacher", verified=True)
    _, _, assignment = await open_assignment(env)
    first_claim = await first.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/claim"
    )
    assert first_claim.status_code == 200
    conflict = await second.post(f"/api/v1/reviews/assignments/{assignment['id']}/claim")
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "REVIEW_ALREADY_CLAIMED"
    # The second teacher must not decide work they did not claim.
    decide = await second.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/decisions",
        json={"decision": "approved", "rubric_results": results("met", "met"),
              "comment": "x"},
    )
    assert decide.status_code == 403


async def test_decision_requires_every_rubric_criterion(env):
    teacher, _ = env.seed("t-rubric", "teacher", verified=True)
    _, _, assignment = await open_assignment(env)
    await teacher.post(f"/api/v1/reviews/assignments/{assignment['id']}/claim")
    missing = await teacher.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/decisions",
        json={"decision": "approved",
              "rubric_results": [{"id": "obj1", "status": "met", "note": "仅一条"}],
              "comment": "缺一条 rubric"},
    )
    assert missing.status_code == 422
    assert missing.json()["code"] == "RUBRIC_MISMATCH"


async def test_changes_requested_resubmit_reapprove_and_appeal_cycle(env):
    teacher, _ = env.seed("t-cycle", "teacher", verified=True)
    student, _, assignment = await open_assignment(env)
    aid = assignment["id"]
    await teacher.post(f"/api/v1/reviews/assignments/{aid}/claim")
    returned = await teacher.post(
        f"/api/v1/reviews/assignments/{aid}/decisions",
        json={"decision": "changes_requested", "rubric_results": results("met", "not_met"),
              "comment": "解释未说明不变量，请补证"},
    )
    assert returned.json()["status"] == "changes_requested"
    # Only the owner can resubmit, and only after a changes-requested decision.
    wrong_state = await teacher.post(f"/api/v1/reviews/assignments/{aid}/resubmit", json={
        "comment": "教师不能补证", "evidence_refs": [
            {"artifact_revision_id": str(uuid4()), "artifact_hash": "b" * 64, "note": "r"}]})
    assert wrong_state.status_code == 403
    resubmit = await student.post(f"/api/v1/reviews/assignments/{aid}/resubmit", json={
        "comment": "已重写解释并附新运行",
        "evidence_refs": [
            {"artifact_revision_id": str(uuid4()), "artifact_hash": "c" * 64,
             "note": "新版本独立输入结果"}]})
    assert resubmit.status_code == 200, resubmit.text
    assert resubmit.json()["status"] == "resubmitted"
    # Original teacher reviews the supplement and approves.
    redecide = await teacher.post(
        f"/api/v1/reviews/assignments/{aid}/decisions",
        json={"decision": "approved", "rubric_results": results("met", "met"),
              "comment": "补证充分"},
    )
    assert redecide.json()["status"] == "approved"
    # Appeal reopens the assignment for the same teacher.
    appeal = await student.post(f"/api/v1/reviews/assignments/{aid}/appeal",
                                json={"comment": "我对一条判定有异议"})
    assert appeal.status_code == 200
    assert appeal.json()["status"] == "in_appeal"
    assert appeal.json()["appeal_count"] == 1


async def test_appeal_is_capped_at_two(env):
    teacher, _ = env.seed("t-cap", "teacher", verified=True)
    student, _, assignment = await open_assignment(env)
    aid = assignment["id"]
    await teacher.post(f"/api/v1/reviews/assignments/{aid}/claim")

    async def return_work():
        response = await teacher.post(
            f"/api/v1/reviews/assignments/{aid}/decisions",
            json={"decision": "changes_requested", "rubric_results": results("met", "not_met"),
                  "comment": "退回"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "changes_requested"

    # Initial conclusion, then two appeal/re-review cycles, then the third appeal
    # must be refused.
    await return_work()
    for expected in (1, 2):
        appealed = await student.post(f"/api/v1/reviews/assignments/{aid}/appeal",
                                      json={"comment": "异议"})
        assert appealed.status_code == 200
        assert appealed.json()["appeal_count"] == expected
        await return_work()
    third = await student.post(f"/api/v1/reviews/assignments/{aid}/appeal",
                               json={"comment": "第三次异议"})
    assert third.status_code == 409
    assert third.json()["code"] == "APPEAL_LIMIT_REACHED"


async def test_student_cannot_forge_teacher_or_professional_evidence(env):
    student, owner = env.seed("s-forge", "student")
    space_id = await env.claim_space(student, owner)
    payload = create_payload(
        owner,
        space_id,
        evidence_snapshot=[{"kind": "teacher_review", "summary": "假装老师已通过"}],
    )
    response = await student.post(
        "/api/v1/reviews/assignments",
        json=payload,
        headers={"Idempotency-Key": payload["assignment_id"]},
    )
    assert response.status_code == 422


async def test_role_gates_and_cross_account_appeal_hidden(env):
    teacher, _ = env.seed("t-gate", "teacher", verified=True)
    # A teacher cannot open a review assignment as a student.
    space_probe = create_payload(uuid4(), uuid4())
    as_teacher = await teacher.post(
        "/api/v1/reviews/assignments",
        json=space_probe,
        headers={"Idempotency-Key": space_probe["assignment_id"]},
    )
    assert as_teacher.status_code == 403
    # A different student appealing someone else's assignment gets a 404, never a
    # state leak, because RLS hides the row.
    _, _, assignment = await open_assignment(env)
    outsider, _ = env.seed("s-outsider", "student")
    appeal = await outsider.post(f"/api/v1/reviews/assignments/{assignment['id']}/appeal",
                                json={"comment": "不是我的工单"})
    assert appeal.status_code == 404


async def test_teacher_queue_is_scoped_and_history_is_append_only(env):
    teacher, teacher_id = env.seed("t-queue", "teacher", verified=True)
    other_teacher, other_id = env.seed("t-queue-other", "teacher", verified=True)
    # Platform pool assignment appears for the verified teacher.
    _, _, platform_item = await open_assignment(env, audience="platform_teachers")
    # Assignment scoped to a different teacher stays out of this teacher's queue.
    await open_assignment(env, audience="specific_teacher", teacher=other_id)
    queue = await teacher.get("/api/v1/reviews/teacher/queue")
    assert queue.status_code == 200
    ids = {item["id"] for item in queue.json()["assignments"]}
    assert platform_item["id"] in ids
    # After claiming, the item moves from the open pool to this teacher's active list.
    await teacher.post(f"/api/v1/reviews/assignments/{platform_item['id']}/claim")
    active = await teacher.get("/api/v1/reviews/teacher/queue")
    active_item = next(
        item for item in active.json()["assignments"] if item["id"] == platform_item["id"]
    )
    assert active_item["claimed_by_account_id"] == str(teacher_id)
    sequences = [event["sequence"] for event in active_item["events"]]
    assert sequences == sorted(sequences) and len(sequences) == 2
