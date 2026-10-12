"""Real PostgreSQL + HTTP tests for the human review and appeal workflow.

Covers the state machine, scoped teacher authorization, cross-account hiding,
no auto-signature without a verified teacher, rubric coverage, multiple valid
solutions (no keyword/word-count scoring), appeals, append-only history, and
now the trust boundary: a review only accepts real synced work with a verified
content fingerprint, derives its server_tool evidence server-side, freezes the
actual work for the teacher, and cannot approve unmet criteria.
"""

import json
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


def insert_synced_code(
    space_id: UUID,
    *,
    artifact_id: UUID | None = None,
    revision_id: UUID | None = None,
    artifact_hash: str | None = None,
    objective: str = "CS01-M01-O1",
    activity_version: str | None = None,
    course_version_id: UUID | None = None,
    fixed_status: str = "met",
    files: dict | None = None,
):
    """Seed a real, already-synced code attempt into the sync projection.

    The review service reads this projection to verify ownership, revision and
    content fingerprint; it never trusts a client-invented UUID/hash.
    """
    owner_url, _ = urls()
    artifact_id = artifact_id or uuid4()
    revision_id = revision_id or uuid4()
    artifact_hash = artifact_hash or ("c" * 64)
    activity_version = activity_version or str(uuid4())
    course_version_id = course_version_id or uuid4()
    payload = {
        "spaceId": str(space_id),
        "id": str(revision_id),
        "artifactId": str(artifact_id),
        "activityKey": f"{activity_version}:base",
        "request": {
            "language": "c17",
            "entry": "main.c",
            "files": files or {"main.c": "int main(void){return 0;}"},
            "stdin": "",
        },
        "requestHash": artifact_hash,
        "result": {
            "status": "success",
            "phase": "run",
            "stdout": "0\n",
            "stderr": "",
            "truncated": False,
            "metadata": {},
            "runtime_profile": "c17-isolate-dev@0.1.0",
            "request_sha256": artifact_hash,
            "client_revision_id": str(revision_id),
            "client_artifact_id": str(artifact_id),
            "mastery_asserted": False,
            "task_assessment": {
                "course_version_id": str(course_version_id),
                "activity_version_id": activity_version,
                "objective_code": objective,
                "task_code": "base",
                "standard_version": "code-fixed-condition-v1",
                "provenance": "server_deterministic_checker",
                "mastery_asserted": False,
                "criteria": [
                    {"id": "fixed_condition", "status": fixed_status, "reason": "r"},
                    {"id": "explanation", "status": "needs_review", "reason": "r"},
                    {"id": "independent_transfer", "status": "needs_review", "reason": "r"},
                ],
            },
        },
        "learning": {
            "context": {
                "courseId": "00000000-0000-0000-0000-000000000000",
                "courseVersionId": str(course_version_id),
                "activityVersionId": activity_version,
                "objectiveCode": objective,
                "taskCode": "base",
                "helpViewed": [],
            },
            "prediction": "",
        },
        "createdAt": datetime.now(UTC).isoformat(),
        "updatedAt": datetime.now(UTC).isoformat(),
    }
    with psycopg.connect(owner_url) as conn:
        conn.execute(
            "INSERT INTO sync_object "
            "(space_id, object_type, object_id, server_object_id, version, "
            "payload_hash, payload, provenance) "
            "VALUES (%s, 'code_attempt', %s, %s, 1, %s, %s::jsonb, 'client_reported')",
            (
                space_id,
                str(revision_id),
                uuid4(),
                bytes.fromhex(artifact_hash),
                json.dumps(payload),
            ),
        )
        conn.commit()
    return SimpleNamespace(
        artifact_id=artifact_id,
        revision_id=revision_id,
        hash=artifact_hash,
        objective=objective,
        activity_version=activity_version,
        course_version_id=course_version_id,
    )


@pytest.fixture
async def env(tmp_path):
    owner_url, api_url = urls()
    # The runtime role is granted table rights by environment bootstrap (never by
    # the migration owner). Scope it minimally: review history is insert-only,
    # assignments are never deleted, and the review must read the sync projection.
    with psycopg.connect(owner_url) as admin:
        admin.execute(
            "GRANT SELECT,INSERT,UPDATE ON review_assignment TO vault_api"
        )
        admin.execute("GRANT SELECT,INSERT ON review_event TO vault_api")
        admin.execute("GRANT SELECT ON sync_object TO vault_api")
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


def create_payload(owner, space_id, work, **overrides):
    assignment_id = overrides.pop("assignment_id", uuid4())
    payload = {
        "assignment_id": str(assignment_id),
        "expected_account_id": str(owner),
        "space_id": str(space_id),
        "audience": "platform_teachers",
        "course_code": "CS01",
        "course_version_id": str(work.course_version_id),
        "objective_code": work.objective,
        "activity_version": work.activity_version,
        "artifact_id": str(work.artifact_id),
        "artifact_revision_id": str(work.revision_id),
        "artifact_hash": work.hash,
        "rubric": RUBRIC,
        "evidence_snapshot": [
            {"kind": "server_tool", "summary": "客户端伪造的核验摘要（应被服务端替换）"},
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


async def open_assignment(env, audience="platform_teachers", teacher=None, work=None):
    student, owner = env.seed(f"s-{uuid4()}", "student")
    space_id = await env.claim_space(student, owner)
    work = work or insert_synced_code(space_id)
    overrides = {"audience": audience}
    if audience == "specific_teacher" and teacher is not None:
        overrides["teacher_account_id"] = str(teacher)
    payload = create_payload(owner, space_id, work, **overrides)
    response = await student.post(
        "/api/v1/reviews/assignments",
        json=payload,
        headers={"Idempotency-Key": payload["assignment_id"]},
    )
    assert response.status_code == 201, response.text
    return student, owner, response.json(), work


async def test_create_without_verified_teacher_is_honestly_unassigned(env):
    _, unverified = env.seed("t-unverified", "teacher", verified=False)
    student, owner, assignment, _ = await open_assignment(
        env, audience="specific_teacher", teacher=unverified
    )
    assert assignment["status"] == "awaiting_review"
    assert assignment["review_service_available"] is False
    assert assignment["claimed_by_account_id"] is None
    assert [event["type"] for event in assignment["events"]] == ["submitted"]
    assert all(event["teacher_signature"] is None for event in assignment["events"])


async def test_unverified_teacher_cannot_claim_and_others_cannot_see(env):
    unverified_client, unverified_id = env.seed("t-pending", "teacher", verified=False)
    student, _, assignment, _ = await open_assignment(
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
    student, _, assignment, _ = await open_assignment(env)
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
    _, _, assignment, _ = await open_assignment(env)
    first_claim = await first.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/claim"
    )
    assert first_claim.status_code == 200
    conflict = await second.post(f"/api/v1/reviews/assignments/{assignment['id']}/claim")
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "REVIEW_ALREADY_CLAIMED"
    decide = await second.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/decisions",
        json={"decision": "approved", "rubric_results": results("met", "met"),
              "comment": "x"},
    )
    assert decide.status_code == 403


async def test_decision_requires_every_rubric_criterion(env):
    teacher, _ = env.seed("t-rubric", "teacher", verified=True)
    _, _, assignment, _ = await open_assignment(env)
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
    student, _, assignment, work = await open_assignment(env)
    aid = assignment["id"]
    await teacher.post(f"/api/v1/reviews/assignments/{aid}/claim")
    returned = await teacher.post(
        f"/api/v1/reviews/assignments/{aid}/decisions",
        json={"decision": "changes_requested", "rubric_results": results("met", "not_met"),
              "comment": "解释未说明不变量，请补证"},
    )
    assert returned.json()["status"] == "changes_requested"
    wrong_state = await teacher.post(f"/api/v1/reviews/assignments/{aid}/resubmit", json={
        "comment": "教师不能补证", "evidence_refs": [
            {"artifact_revision_id": str(uuid4()), "artifact_hash": "b" * 64, "note": "r"}]})
    assert wrong_state.status_code == 403
    # A real new synced revision (not a random UUID + hand-typed hash).
    new_work = insert_synced_code(
        UUID(assignment["space_id"]),
        artifact_id=work.artifact_id,
        objective=work.objective,
        activity_version=work.activity_version,
        course_version_id=work.course_version_id,
    )
    resubmit = await student.post(f"/api/v1/reviews/assignments/{aid}/resubmit", json={
        "comment": "已重写解释并附新运行",
        "evidence_refs": [
            {"artifact_revision_id": str(new_work.revision_id),
             "artifact_hash": new_work.hash, "note": "新版本独立输入结果"}]})
    assert resubmit.status_code == 200, resubmit.text
    assert resubmit.json()["status"] == "resubmitted"
    assert len(resubmit.json()["work_snapshot"]) == 2
    redecide = await teacher.post(
        f"/api/v1/reviews/assignments/{aid}/decisions",
        json={"decision": "approved", "rubric_results": results("met", "met"),
              "comment": "补证充分"},
    )
    assert redecide.json()["status"] == "approved"
    appeal = await student.post(f"/api/v1/reviews/assignments/{aid}/appeal",
                                json={"comment": "我对一条判定有异议"})
    assert appeal.status_code == 200
    assert appeal.json()["status"] == "in_appeal"
    assert appeal.json()["appeal_count"] == 1


async def test_appeal_is_capped_at_two(env):
    teacher, _ = env.seed("t-cap", "teacher", verified=True)
    student, _, assignment, _ = await open_assignment(env)
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
    work = insert_synced_code(space_id)
    payload = create_payload(
        owner,
        space_id,
        work,
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
    # A teacher cannot open a review assignment as a student (403 before work checks).
    work = SimpleNamespace(
        artifact_id=uuid4(), revision_id=uuid4(), hash="d" * 64,
        objective="CS01-M01-O1", activity_version=str(uuid4()),
        course_version_id=uuid4(),
    )
    space_probe = create_payload(uuid4(), uuid4(), work)
    as_teacher = await teacher.post(
        "/api/v1/reviews/assignments",
        json=space_probe,
        headers={"Idempotency-Key": space_probe["assignment_id"]},
    )
    assert as_teacher.status_code == 403
    _, _, assignment, _ = await open_assignment(env)
    outsider, _ = env.seed("s-outsider", "student")
    appeal = await outsider.post(f"/api/v1/reviews/assignments/{assignment['id']}/appeal",
                                 json={"comment": "不是我的工单"})
    assert appeal.status_code == 404


async def test_teacher_queue_is_scoped_and_history_is_append_only(env):
    teacher, teacher_id = env.seed("t-queue", "teacher", verified=True)
    other_teacher, other_id = env.seed("t-queue-other", "teacher", verified=True)
    _, _, platform_item, _ = await open_assignment(env, audience="platform_teachers")
    await open_assignment(env, audience="specific_teacher", teacher=other_id)
    queue = await teacher.get("/api/v1/reviews/teacher/queue")
    assert queue.status_code == 200
    ids = {item["id"] for item in queue.json()["assignments"]}
    assert platform_item["id"] in ids
    await teacher.post(f"/api/v1/reviews/assignments/{platform_item['id']}/claim")
    active = await teacher.get("/api/v1/reviews/teacher/queue")
    active_item = next(
        item for item in active.json()["assignments"] if item["id"] == platform_item["id"]
    )
    assert active_item["claimed_by_account_id"] == str(teacher_id)
    sequences = [event["sequence"] for event in active_item["events"]]
    assert sequences == sorted(sequences) and len(sequences) == 2


# --- Trust boundary: real work, derived evidence, frozen snapshot -------------


async def test_unsynced_work_is_rejected_with_a_clear_sync_hint(env):
    student, owner = env.seed("s-unsynced", "student")
    space_id = await env.claim_space(student, owner)
    # A client-invented UUID/hash with no sync projection must be refused.
    work = SimpleNamespace(
        artifact_id=uuid4(), revision_id=uuid4(), hash="d" * 64,
        objective="CS01-M01-O1", activity_version=str(uuid4()),
        course_version_id=uuid4(),
    )
    payload = create_payload(owner, space_id, work)
    response = await student.post(
        "/api/v1/reviews/assignments",
        json=payload,
        headers={"Idempotency-Key": payload["assignment_id"]},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "WORK_NOT_SYNCED"
    assert "同步" in response.json()["message"]


async def test_hash_mismatch_is_rejected(env):
    student, owner = env.seed("s-hash", "student")
    space_id = await env.claim_space(student, owner)
    work = insert_synced_code(space_id)
    payload = create_payload(owner, space_id, work, artifact_hash="e" * 64)
    response = await student.post(
        "/api/v1/reviews/assignments",
        json=payload,
        headers={"Idempotency-Key": payload["assignment_id"]},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "WORK_HASH_MISMATCH"


async def test_server_tool_evidence_is_derived_not_client_authored(env):
    student, owner, assignment, work = await open_assignment(env)
    # The client summary is discarded; the server derives the real one.
    assert assignment["evidence_snapshot"][0]["kind"] == "server_tool"
    assert "服务端受信核验" in assignment["evidence_snapshot"][0]["summary"]
    assert "伪造" not in assignment["evidence_snapshot"][0]["summary"]
    assert assignment["evidence_snapshot"][1]["kind"] == "student_self"
    # The frozen work snapshot contains the real source, not just a summary.
    assert assignment["work_snapshot"][0]["kind"] == "code_attempt"
    assert assignment["work_snapshot"][0]["artifact_hash"] == work.hash
    assert assignment["work_snapshot"][0]["request"]["files"] == {
        "main.c": "int main(void){return 0;}"
    }


async def test_teacher_sees_the_frozen_real_work(env):
    teacher, _ = env.seed("t-view", "teacher", verified=True)
    student, _, assignment, _ = await open_assignment(env)
    await teacher.post(f"/api/v1/reviews/assignments/{assignment['id']}/claim")
    fetched = await teacher.get(f"/api/v1/reviews/assignments/{assignment['id']}")
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["work_snapshot"][0]["request"]["files"]["main.c"].startswith("int main")
    assert body["work_snapshot"][0]["result"]["task_assessment"]["provenance"] == (
        "server_deterministic_checker"
    )


async def test_approve_with_unmet_criteria_is_rejected(env):
    teacher, _ = env.seed("t-unmet", "teacher", verified=True)
    _, _, assignment, _ = await open_assignment(env)
    await teacher.post(f"/api/v1/reviews/assignments/{assignment['id']}/claim")
    decision = await teacher.post(
        f"/api/v1/reviews/assignments/{assignment['id']}/decisions",
        json={"decision": "approved", "rubric_results": results("met", "not_met"),
              "comment": "想直接通过"},
    )
    assert decision.status_code == 422
    assert decision.json()["code"] == "CANNOT_APPROVE_UNMET_CRITERIA"


async def test_resubmit_rejects_random_revision_or_hand_typed_hash(env):
    teacher, _ = env.seed("t-ref", "teacher", verified=True)
    student, _, assignment, _ = await open_assignment(env)
    aid = assignment["id"]
    await teacher.post(f"/api/v1/reviews/assignments/{aid}/claim")
    await teacher.post(
        f"/api/v1/reviews/assignments/{aid}/decisions",
        json={"decision": "changes_requested", "rubric_results": results("met", "not_met"),
              "comment": "退回"},
    )
    # A random revision UUID + hand-typed hash is not a real synced work.
    resubmit = await student.post(f"/api/v1/reviews/assignments/{aid}/resubmit", json={
        "comment": "补证",
        "evidence_refs": [
            {"artifact_revision_id": str(uuid4()), "artifact_hash": "f" * 64, "note": "手填"}]})
    assert resubmit.status_code == 409
    assert resubmit.json()["code"] == "WORK_NOT_SYNCED"
