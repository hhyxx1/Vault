"""Human review and appeal workflow for a single frozen student work version.

A review assignment is created only by the owning student and grants a teacher
access to exactly one artifact revision. Teachers never browse a student's
space. Nothing is auto-claimed and no teacher signature exists unless a
verified-teacher session records the decision; when no verified teacher is
staffed the assignment stays unassigned and reports the service as unavailable.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, Request
from sqlalchemy import func, select, text

from vault_backend.auth import authorized_transaction
from vault_backend.code_execution import CodeRequest
from vault_backend.errors import ApiError
from vault_backend.models import (
    ReviewAssignment,
    ReviewEvent,
    ServerVerification,
    TeacherProfile,
)
from vault_backend.redaction import redact_hidden_suite_fields
from vault_backend.review_schemas import (
    MAX_APPEALS,
    AppealRequest,
    DecisionRequest,
    ResubmitRequest,
    ReviewAssignmentOut,
    ReviewCreateRequest,
    ReviewEventOut,
    ReviewListOut,
)
from vault_backend.review_work import content_hash, manual_content
from vault_backend.sync import own_space
from vault_backend.sync_models import SyncObject

router = APIRouter(prefix="/api/v1/reviews", tags=["Human review"])

_STUDENT_SOURCE_KINDS = {"server_tool", "model_suggestion", "student_self"}
_DECISION_STATES = {"claimed", "resubmitted", "in_appeal"}


def _now() -> datetime:
    return datetime.now(UTC)


def require_student(principal) -> None:
    if principal.account_type != "student":
        raise ApiError(403, "STUDENT_ACCOUNT_REQUIRED", "只有学生账号可以提交作品审阅请求。")


def require_verified_teacher(principal) -> None:
    if principal.account_type != "teacher" or principal.teacher_verification_state != "verified":
        raise ApiError(
            403,
            "TEACHER_VERIFICATION_REQUIRED",
            "只有已通过认证的教师可以接单或给出审阅意见；当前不会代签任何审阅。",
        )


def require_key(value: str | None, expected: UUID) -> None:
    try:
        valid = UUID(value or "") == expected
    except ValueError:
        valid = False
    if not valid:
        raise ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "幂等键必须与本次审阅请求 ID 一致。")


async def service_available(session, audience: str, teacher_id: UUID | None) -> bool:
    target = teacher_id if audience == "specific_teacher" else None
    value = await session.scalar(
        text("SELECT vault_verified_teacher_exists(:teacher)"), {"teacher": target}
    )
    return bool(value)


def teacher_authorized(assignment: ReviewAssignment, teacher_id: UUID) -> bool:
    if assignment.audience == "specific_teacher":
        return assignment.teacher_account_id == teacher_id
    return True


async def _load_synced_code_attempt(
    session, space_id: UUID, revision_id: UUID, work_kind: str = "code_attempt"
) -> dict | None:
    """The client-reported sync projection of one code attempt, or None.

    The projection is validated on import (shape, hash binding, provenance), so
    a review can trust it as the student's *real* work record instead of a
    client-invented UUID/hash, even though the projection itself stays
    client_reported for trust purposes.
    """
    obj = await session.get(SyncObject, (space_id, work_kind, str(revision_id)))
    if obj is None or obj.payload is None:
        return None
    # Legacy rows may predate trust-boundary redaction; never carry historical
    # hidden independent inputs into a frozen review snapshot.
    payload = redact_hidden_suite_fields(obj.payload)
    if work_kind != "code_attempt":
        content = manual_content(work_kind, payload)
        payload = dict(
            payload,
            _work_kind=work_kind,
            _content=content,
            requestHash=content_hash(content),
            learning={
                "context": {
                    "objectiveCode": payload.get("objectiveCode", payload.get("objectiveId")),
                    "courseVersionId": payload.get("courseVersionId"),
                    "activityVersionId": payload.get(
                        "activityVersionId", payload.get("activityVersion")
                    ),
                }
            },
        )
    return payload


def _verified_code_work(
    payload: dict | None,
    *,
    revision_id: UUID,
    artifact_hash: str,
    objective_code: str,
    activity_version: str,
    course_version_id: UUID | None,
    expected_artifact_id: UUID | None = None,
) -> tuple[dict, UUID]:
    """Verify a synced code attempt matches the claimed revision/fingerprint.

    Returns ``(payload, artifact_id)``; the artifact id is read from the trusted
    projection so a resubmission cannot invent one. Ownership, revision and the
    content fingerprint are checked here; the *result* is never trusted from the
    upload — a runnable work may be submitted even without a client result,
    because the server re-executes it to obtain authoritative evidence. An
    imported result stays advisory ("client reported") in the snapshot.
    """
    if payload is None:
        raise ApiError(
            409,
            "WORK_NOT_SYNCED",
            "该作品尚未同步到服务端，请先在知识图谱完成同步后再提交审阅。",
        )
    if str(payload.get("id")) != str(revision_id):
        raise ApiError(422, "WORK_MISMATCH", "作品修订与审阅请求不一致。")
    artifact_id = payload.get("artifactId")
    try:
        artifact_id = UUID(str(artifact_id))
    except (ValueError, TypeError):
        raise ApiError(422, "WORK_MISMATCH", "作品归属记录无效。") from None
    if expected_artifact_id is not None and artifact_id != expected_artifact_id:
        raise ApiError(422, "WORK_MISMATCH", "作品归属与审阅请求不一致。")
    if payload.get("requestHash") != artifact_hash:
        raise ApiError(422, "WORK_HASH_MISMATCH", "作品内容指纹与审阅请求不一致。")
    context = (payload.get("learning") or {}).get("context") or {}
    if context.get("objectiveCode") != objective_code:
        raise ApiError(422, "WORK_MISMATCH", "作品所属目标与审阅请求不一致。")
    if course_version_id is not None and str(context.get("courseVersionId")) != str(
        course_version_id
    ):
        raise ApiError(422, "WORK_MISMATCH", "作品课程版本与审阅请求不一致。")
    if context.get("activityVersionId") != activity_version:
        raise ApiError(422, "WORK_MISMATCH", "作品活动版本与审阅请求不一致。")
    return payload, artifact_id


def _server_tool_summary(verification: dict, artifact_hash: str) -> str:
    """Summary built ONLY from the server's own execution record.

    Never derived from the client-uploaded sync projection: a forged but
    byte-consistent upload has no server execution behind it and so cannot
    produce this evidence item.
    """
    label = {"met": "通过", "not_met": "未通过", "needs_review": "待复核"}.get(
        verification.get("outcome"), "未知"
    )
    return (
        f"服务端在隔离环境重新执行该作品（{verification.get('standard_version')}，"
        f"{verification.get('checker_kind')}）：固定条件 {label}；"
        f"作品内容指纹 {artifact_hash[:16]}…。仅代表该次运行，不等于教师已认可。"
    )


def _freeze_work(
    payload: dict,
    *,
    artifact_id: UUID,
    revision_id: UUID,
    artifact_hash: str,
    note: str | None,
    context: dict | None = None,
    help_records: list | None = None,
    verification: dict | None = None,
) -> dict:
    request = payload.get("request") or {}
    return {
        "kind": "code_attempt",
        "artifact_id": str(artifact_id),
        "artifact_revision_id": str(revision_id),
        "artifact_hash": artifact_hash,
        "note": note or "",
        "request": request,
        # Necessary learning context and help disclosures travel with the frozen
        # snapshot so a teacher reviews the real study situation; visibility is
        # still bounded by the RLS-scoped assignment.
        "learning_context": context or {},
        "help_records": help_records or [],
        "server_verification": verification,
        # The student's own imported report is kept as advisory, clearly
        # labelled — and redacted so historical hidden suite secrets never enter
        # the frozen snapshot a teacher can read.
        "client_reported_result": redact_hidden_suite_fields({"result": payload.get("result")}).get(
            "result"
        ),
    }


# The platform's necessary review dimensions for a course objective. A student
# cannot reduce or reorder them; the server rejects missing/duplicate/extra rows.
STANDARD_RUBRIC_IDS = ("objective", "explanation", "independent")
STANDARD_RUBRIC_KINDS = {
    "objective": "objective",
    "explanation": "explanation",
    "independent": "independent_transfer",
}


def validate_rubric(items: list) -> list[dict]:
    ids = [item.id for item in items]
    if len(set(ids)) != len(ids):
        raise ApiError(422, "RUBRIC_DUPLICATE", "审阅标准不能包含重复条目。")
    if set(ids) != set(STANDARD_RUBRIC_IDS):
        raise ApiError(
            422,
            "RUBRIC_MISMATCH",
            "审阅标准必须与课程目标的必要表现完全一致，不能增删必要条目。",
        )
    for item in items:
        if item.kind != STANDARD_RUBRIC_KINDS[item.id]:
            raise ApiError(422, "RUBRIC_MISMATCH", "审阅标准条目的评价维度与课程定义不一致。")
    titles = {
        "objective": "客观结果与不变量",
        "explanation": "解释与设计",
        "independent": "独立迁移表现",
    }
    return [
        {"id": key, "kind": STANDARD_RUBRIC_KINDS[key], "title": titles[key]}
        for key in STANDARD_RUBRIC_IDS
    ]


async def _load_help_records(session, space_id: UUID, objective_code: str) -> list[dict]:
    """Versioned help disclosures the student made for this objective.

    Read from the student's own sync projection (RLS-scoped to their space); a
    teacher only ever sees these through the frozen assignment snapshot.
    """
    rows = (
        await session.scalars(
            select(SyncObject).where(
                SyncObject.space_id == space_id,
                SyncObject.object_type == "help",
            )
        )
    ).all()
    records: list[dict] = []
    for row in rows:
        payload = row.payload or {}
        if payload.get("objectiveId") != objective_code:
            continue
        records.append(
            {
                "kind": payload.get("kind"),
                "disclosureVersion": payload.get("disclosureVersion"),
                "createdAt": payload.get("createdAt"),
                "courseVersion": payload.get("courseVersion"),
                "activityVersion": payload.get("activityVersion"),
            }
        )
    return records


async def authoritative_verification(
    request,
    session,
    *,
    principal,
    space_id: UUID,
    artifact_id: UUID,
    revision_id: UUID,
    artifact_hash: str,
    course_code: str,
    course_version_id: UUID | None,
    payload: dict,
    note: str | None,
) -> tuple[dict, ServerVerification | None]:
    """Re-run the synced work server-side and persist the authoritative record.

    Raises a clear ``CODE_WORKER_UNAVAILABLE`` / ``CHECK_UNAVAILABLE`` when the
    platform cannot itself verify the work, so the caller must ask the student
    to re-verify rather than trusting the imported result.
    """
    if payload.get("_work_kind"):
        context = payload["learning"]["context"]
        if payload.get("courseCode") != course_code:
            raise ApiError(422, "WORK_MISMATCH", "作品课程与审阅请求不一致。")
        return {
            "kind": payload["_work_kind"],
            "artifact_id": str(artifact_id),
            "artifact_revision_id": str(revision_id),
            "artifact_hash": artifact_hash,
            "note": note or "",
            "content": payload["_content"],
            "learning_context": context,
            "server_verification": None,
            "help_records": await _load_help_records(session, space_id, context["objectiveCode"]),
            "client_reported_result": redact_hidden_suite_fields(
                {"result": payload.get("result")}
            ).get("result"),
        }, None
    verifier = getattr(request.app.state, "authoritative_verifier", None)
    if verifier is None:
        raise ApiError(503, "CODE_WORKER_UNAVAILABLE", "服务端核验未配置，无法提交人工审阅。")
    context = (payload.get("learning") or {}).get("context") or {}
    try:
        code = CodeRequest.model_validate(payload.get("request") or {})
    except Exception:
        raise ApiError(422, "WORK_MISMATCH", "作品源文件无法解析。") from None
    record = await verifier.run(
        code,
        course_version_id=str(context.get("courseVersionId")),
        objective_code=str(context.get("objectiveCode")),
        activity_version_id=str(context.get("activityVersionId")),
        task_code=str(context.get("taskCode")),
    )
    verification = await session.scalar(
        select(ServerVerification).where(
            ServerVerification.owner_account_id == principal.account_id,
            ServerVerification.artifact_revision_id == revision_id,
            ServerVerification.artifact_hash == bytes.fromhex(artifact_hash),
            ServerVerification.checker_kind == record["checker_kind"],
            ServerVerification.standard_version == record["standard_version"],
        )
    )
    if verification is None:
        verification = ServerVerification(
            id=uuid4(),
            owner_account_id=principal.account_id,
            space_id=space_id,
            artifact_id=artifact_id,
            artifact_revision_id=revision_id,
            artifact_hash=bytes.fromhex(artifact_hash),
            course_code=course_code,
            course_version_id=course_version_id,
            activity_version_id=UUID(str(context.get("activityVersionId"))),
            objective_code=str(context.get("objectiveCode")),
            task_code=str(context.get("taskCode")),
            checker_kind=record["checker_kind"],
            standard_version=record["standard_version"],
            provenance="server_execution",
            outcome=record["outcome"],
            detail=record["detail"],
        )
        session.add(verification)
        await session.flush()
    authoritative = {
        "verification_id": str(verification.id),
        "checker_kind": verification.checker_kind,
        "standard_version": verification.standard_version,
        "provenance": verification.provenance,
        "outcome": verification.outcome,
        "detail": verification.detail,
        "created_at": verification.created_at.isoformat() if verification.created_at else None,
    }
    freeze = _freeze_work(
        payload,
        artifact_id=artifact_id,
        revision_id=revision_id,
        artifact_hash=artifact_hash,
        note=note,
        context=context,
        help_records=await _load_help_records(session, space_id, str(context.get("objectiveCode"))),
        verification=authoritative,
    )
    return freeze, verification


async def next_sequence(session, assignment_id: UUID) -> int:
    current = await session.scalar(
        select(func.coalesce(func.max(ReviewEvent.sequence), 0)).where(
            ReviewEvent.assignment_id == assignment_id
        )
    )
    return int(current) + 1


async def add_event(
    session,
    assignment: ReviewAssignment,
    *,
    type: str,
    actor_account_id: UUID,
    actor_role: str,
    decision: str | None = None,
    rubric_results: list | None = None,
    comment: str | None = None,
    evidence_refs: list | None = None,
    teacher_signature: dict | None = None,
) -> ReviewEvent:
    event = ReviewEvent(
        assignment_id=assignment.id,
        space_id=assignment.space_id,
        owner_account_id=assignment.owner_account_id,
        sequence=await next_sequence(session, assignment.id),
        type=type,
        actor_account_id=actor_account_id,
        actor_role=actor_role,
        decision=decision,
        rubric_results=rubric_results,
        comment=comment,
        evidence_refs=evidence_refs,
        teacher_signature=teacher_signature,
        created_at=_now(),
    )
    session.add(event)
    return event


def serialize_event(event: ReviewEvent) -> ReviewEventOut:
    return ReviewEventOut(
        id=event.id,
        sequence=event.sequence,
        type=event.type,
        actor_account_id=event.actor_account_id,
        actor_role=event.actor_role,
        decision=event.decision,
        rubric_results=event.rubric_results,
        comment=event.comment,
        evidence_refs=event.evidence_refs,
        teacher_signature=event.teacher_signature,
        created_at=event.created_at.isoformat(),
    )


async def serialize(session, assignment: ReviewAssignment) -> ReviewAssignmentOut:
    events = (
        await session.scalars(
            select(ReviewEvent)
            .where(ReviewEvent.assignment_id == assignment.id)
            .order_by(ReviewEvent.sequence)
        )
    ).all()
    return ReviewAssignmentOut(
        id=assignment.id,
        space_id=assignment.space_id,
        owner_account_id=assignment.owner_account_id,
        audience=assignment.audience,
        teacher_account_id=assignment.teacher_account_id,
        course_code=assignment.course_code,
        course_version_id=assignment.course_version_id,
        objective_code=assignment.objective_code,
        activity_version=assignment.activity_version,
        artifact_id=assignment.artifact_id,
        artifact_revision_id=assignment.artifact_revision_id,
        artifact_hash=assignment.artifact_hash.hex(),
        rubric=assignment.rubric,
        evidence_snapshot=assignment.evidence_snapshot,
        work_snapshot=redact_hidden_suite_fields(assignment.work_snapshot),
        status=assignment.status,
        claimed_by_account_id=assignment.claimed_by_account_id,
        review_service_available=assignment.review_service_available,
        appeal_count=assignment.appeal_count,
        created_at=assignment.created_at.isoformat(),
        updated_at=assignment.updated_at.isoformat(),
        events=[serialize_event(event) for event in events],
    )


async def locked_assignment(session, assignment_id: UUID) -> ReviewAssignment:
    assignment = await session.scalar(
        select(ReviewAssignment).where(ReviewAssignment.id == assignment_id).with_for_update()
    )
    if assignment is None:
        # RLS already hides anything the caller may not see; stay indistinguishable.
        raise ApiError(404, "REVIEW_NOT_FOUND", "该审阅请求不存在或你无权访问。")
    return assignment


@router.post(
    "/assignments",
    response_model=ReviewAssignmentOut,
    status_code=201,
    operation_id="createReviewAssignment",
)
async def create_assignment(
    request: Request,
    body: ReviewCreateRequest,
    idempotency_key: Annotated[str | None, Header()] = None,
):
    require_key(idempotency_key, body.assignment_id)
    async with authorized_transaction(request, write=True) as (session, principal):
        require_student(principal)
        if principal.account_id != body.expected_account_id:
            raise ApiError(409, "ACCOUNT_CHANGED", "账号已变化，请用当前账号重新提交审阅请求。")
        await own_space(session, principal.account_id, body.space_id)
        for item in body.evidence_snapshot:
            if item.kind not in _STUDENT_SOURCE_KINDS:
                raise ApiError(
                    422,
                    "EVIDENCE_PROVENANCE_FORBIDDEN",
                    "提交审阅时不得附带教师意见或专业审校来源。",
                )
        # The review rubric is a platform/course standard; the student cannot
        # reduce the necessary dimensions or add conflicting ones.
        rubric = validate_rubric(body.rubric)
        existing = await session.get(ReviewAssignment, body.assignment_id)
        if existing is not None:
            if (
                existing.space_id != body.space_id
                or existing.artifact_revision_id != body.artifact_revision_id
                or existing.objective_code != body.objective_code
            ):
                raise ApiError(409, "IDEMPOTENCY_CONFLICT", "该审阅请求已固定为另一份作品或目标。")
            return await serialize(session, existing)
        # The claimed work must be a real, owned, synced code attempt bound to
        # this course context; ownership/revision/fingerprint are verified first.
        payload, artifact_id = _verified_code_work(
            await _load_synced_code_attempt(
                session, body.space_id, body.artifact_revision_id, body.work_kind
            ),
            revision_id=body.artifact_revision_id,
            artifact_hash=body.artifact_hash,
            objective_code=body.objective_code,
            activity_version=body.activity_version,
            course_version_id=body.course_version_id,
            expected_artifact_id=body.artifact_id,
        )
        # server_tool evidence may only come from a run the platform performs
        # itself; a forged but field-consistent sync upload has no such record.
        freeze, _verification = await authoritative_verification(
            request,
            session,
            principal=principal,
            space_id=body.space_id,
            artifact_id=artifact_id,
            revision_id=body.artifact_revision_id,
            artifact_hash=body.artifact_hash,
            course_code=body.course_code,
            course_version_id=body.course_version_id,
            payload=payload,
            note=body.student_note,
        )
        authoritative = freeze["server_verification"]
        evidence_snapshot = (
            [
                {
                    "kind": "server_tool",
                    "summary": _server_tool_summary(authoritative, body.artifact_hash),
                }
            ]
            if authoritative
            else [
                {
                    "kind": "student_self",
                    "summary": "已冻结学生作品，尚无自动核验结论，请教师审阅。",
                }
            ]
        ) + [
            item.model_dump(mode="json")
            for item in body.evidence_snapshot
            if item.kind != "server_tool"
        ]
        work_snapshot = [freeze]
        available = await service_available(session, body.audience, body.teacher_account_id)
        now = _now()
        assignment = ReviewAssignment(
            id=body.assignment_id,
            space_id=body.space_id,
            owner_account_id=principal.account_id,
            audience=body.audience,
            teacher_account_id=body.teacher_account_id,
            course_code=body.course_code,
            course_version_id=body.course_version_id,
            objective_code=body.objective_code,
            activity_version=body.activity_version,
            artifact_id=body.artifact_id,
            artifact_revision_id=body.artifact_revision_id,
            artifact_hash=bytes.fromhex(body.artifact_hash),
            rubric=rubric,
            evidence_snapshot=evidence_snapshot,
            work_snapshot=work_snapshot,
            status="awaiting_review",
            review_service_available=available,
            appeal_count=0,
            created_at=now,
            updated_at=now,
        )
        session.add(assignment)
        await session.flush()
        await add_event(
            session,
            assignment,
            type="submitted",
            actor_account_id=principal.account_id,
            actor_role="student",
            comment=body.student_note,
        )
        await session.flush()
        return await serialize(session, assignment)


@router.get(
    "/assignments/mine",
    response_model=ReviewListOut,
    operation_id="listMyReviewAssignments",
)
async def list_mine(request: Request):
    async with authorized_transaction(request, write=False) as (session, principal):
        require_student(principal)
        rows = (
            await session.scalars(
                select(ReviewAssignment)
                .where(ReviewAssignment.owner_account_id == principal.account_id)
                .order_by(ReviewAssignment.created_at)
            )
        ).all()
        return ReviewListOut(assignments=[await serialize(session, row) for row in rows])


@router.get(
    "/assignments/{assignment_id}",
    response_model=ReviewAssignmentOut,
    operation_id="getReviewAssignment",
)
async def get_assignment(request: Request, assignment_id: UUID):
    async with authorized_transaction(request, write=False) as (session, principal):
        assignment = await locked_assignment(session, assignment_id)
        is_owner = (
            principal.account_type == "student"
            and assignment.owner_account_id == principal.account_id
        )
        is_teacher = (
            principal.account_type == "teacher"
            and (principal.teacher_verification_state == "verified")
            and teacher_authorized(assignment, principal.account_id)
        )
        if not is_owner and not is_teacher:
            raise ApiError(403, "REVIEW_ACCESS_DENIED", "你无权查看该审阅请求。")
        return await serialize(session, assignment)


@router.get("/teacher/queue", response_model=ReviewListOut, operation_id="listReviewQueue")
async def teacher_queue(request: Request):
    async with authorized_transaction(request, write=False) as (session, principal):
        require_verified_teacher(principal)
        available_rows = (
            await session.scalars(
                select(ReviewAssignment)
                .where(ReviewAssignment.status == "awaiting_review")
                .where(ReviewAssignment.claimed_by_account_id.is_(None))
                .order_by(ReviewAssignment.created_at)
            )
        ).all()
        active_rows = (
            await session.scalars(
                select(ReviewAssignment)
                .where(ReviewAssignment.claimed_by_account_id == principal.account_id)
                .where(ReviewAssignment.status != "approved")
                .order_by(ReviewAssignment.updated_at)
            )
        ).all()
        rows = [
            row for row in available_rows if teacher_authorized(row, principal.account_id)
        ] + list(active_rows)
        return ReviewListOut(assignments=[await serialize(session, row) for row in rows])


@router.post(
    "/assignments/{assignment_id}/claim",
    response_model=ReviewAssignmentOut,
    operation_id="claimReviewAssignment",
)
async def claim(request: Request, assignment_id: UUID):
    async with authorized_transaction(request, write=True) as (session, principal):
        require_verified_teacher(principal)
        assignment = await locked_assignment(session, assignment_id)
        if not teacher_authorized(assignment, principal.account_id):
            raise ApiError(403, "REVIEW_ACCESS_DENIED", "该审阅请求未授权给你。")
        if assignment.claimed_by_account_id not in (None, principal.account_id):
            raise ApiError(409, "REVIEW_ALREADY_CLAIMED", "该审阅请求已由其他教师接单。")
        if assignment.status != "awaiting_review":
            raise ApiError(409, "REVIEW_STATUS_CONFLICT", "该审阅请求当前不在待接单状态。")
        assignment.claimed_by_account_id = principal.account_id
        assignment.status = "claimed"
        assignment.updated_at = _now()
        await add_event(
            session,
            assignment,
            type="claimed",
            actor_account_id=principal.account_id,
            actor_role="teacher",
        )
        await session.flush()
        return await serialize(session, assignment)


@router.post(
    "/assignments/{assignment_id}/decisions",
    response_model=ReviewAssignmentOut,
    operation_id="decideReviewAssignment",
)
async def decide(request: Request, assignment_id: UUID, body: DecisionRequest):
    async with authorized_transaction(request, write=True) as (session, principal):
        require_verified_teacher(principal)
        assignment = await locked_assignment(session, assignment_id)
        if assignment.claimed_by_account_id != principal.account_id:
            raise ApiError(403, "REVIEW_ACCESS_DENIED", "只有接单教师可以给出审阅结论。")
        if assignment.status not in _DECISION_STATES:
            raise ApiError(
                409, "REVIEW_STATUS_CONFLICT", "当前状态不能提交审阅结论，请先确认工单进度。"
            )
        expected_ids = {criterion["id"] for criterion in assignment.rubric}
        received = {result.id for result in body.rubric_results}
        if received != expected_ids or len(received) != len(body.rubric_results):
            raise ApiError(
                422,
                "RUBRIC_MISMATCH",
                "必须对工单中的每一条 rubric 逐项给出判定，且不能增加条目。",
            )
        # A "通过" cannot be signed while any necessary criterion is unmet or
        # still pending: learning attainment and administrative closure are
        # separate concerns, so an unmet objective can only be returned for
        # more evidence, never rubber-stamped.
        if body.decision == "approved" and any(
            result.status != "met" for result in body.rubric_results
        ):
            raise ApiError(
                422,
                "CANNOT_APPROVE_UNMET_CRITERIA",
                "存在未达到或待核的 rubric 条目，不能判定通过；请退回补充材料。",
            )
        if body.decision == "approved":
            current_work = (
                (assignment.work_snapshot or [])[-1] if assignment.work_snapshot else None
            )
            if current_work and current_work.get("kind") == "code_attempt":
                verification = current_work.get("server_verification") or {}
                if (
                    verification.get("provenance") != "server_execution"
                    or verification.get("outcome") != "met"
                ):
                    raise ApiError(
                        422,
                        "CANNOT_APPROVE_UNVERIFIED_CODE",
                        "最新代码作品尚未通过服务端核验，请退回补证后再签署。",
                    )
        profile = await session.get(TeacherProfile, principal.account_id)
        display_name = profile.display_name if profile is not None else ""
        signature = {
            "teacher_account_id": str(principal.account_id),
            "display_name": display_name,
            "verification_state": "verified",
            "signed_at": _now().isoformat(),
        }
        assignment.status = "approved" if body.decision == "approved" else "changes_requested"
        assignment.updated_at = _now()
        await add_event(
            session,
            assignment,
            type="decision",
            actor_account_id=principal.account_id,
            actor_role="teacher",
            decision=body.decision,
            rubric_results=[result.model_dump(mode="json") for result in body.rubric_results],
            comment=body.comment,
            teacher_signature=signature,
        )
        await session.flush()
        return await serialize(session, assignment)


@router.post(
    "/assignments/{assignment_id}/resubmit",
    response_model=ReviewAssignmentOut,
    operation_id="resubmitReviewAssignment",
)
async def resubmit(request: Request, assignment_id: UUID, body: ResubmitRequest):
    async with authorized_transaction(request, write=True) as (session, principal):
        require_student(principal)
        assignment = await locked_assignment(session, assignment_id)
        if assignment.owner_account_id != principal.account_id:
            raise ApiError(403, "REVIEW_ACCESS_DENIED", "你无权操作该审阅请求。")
        if assignment.status != "changes_requested":
            raise ApiError(409, "REVIEW_STATUS_CONFLICT", "只有被退回补证的工单可以补充材料。")
        # Each supplement must reference a real, owned, synced code revision with
        # a matching content fingerprint, re-verified server-side; a random UUID
        # plus a hand-typed hash is rejected instead of being frozen as evidence.
        supplements: list[dict] = []
        evidence_refs: list[dict] = []
        seen_revisions = {item["artifact_revision_id"] for item in assignment.work_snapshot}
        seen_revisions.add(str(assignment.artifact_revision_id))
        for ref in body.evidence_refs:
            if str(ref.artifact_revision_id) in seen_revisions:
                raise ApiError(422, "WORK_REVISION_REUSED", "请提交尚未审阅的新作品版本。")
            seen_revisions.add(str(ref.artifact_revision_id))
            payload, artifact_id = _verified_code_work(
                await _load_synced_code_attempt(
                    session, assignment.space_id, ref.artifact_revision_id, ref.work_kind
                ),
                revision_id=ref.artifact_revision_id,
                artifact_hash=ref.artifact_hash,
                objective_code=assignment.objective_code,
                activity_version=assignment.activity_version,
                course_version_id=assignment.course_version_id,
            )
            freeze, _verification = await authoritative_verification(
                request,
                session,
                principal=principal,
                space_id=assignment.space_id,
                artifact_id=artifact_id,
                revision_id=ref.artifact_revision_id,
                artifact_hash=ref.artifact_hash,
                course_code=assignment.course_code,
                course_version_id=assignment.course_version_id,
                payload=payload,
                note=ref.note,
            )
            supplements.append(freeze)
            evidence_refs.append(ref.model_dump(mode="json"))
        assignment.work_snapshot = [*assignment.work_snapshot, *supplements]
        assignment.status = "resubmitted"
        assignment.updated_at = _now()
        await add_event(
            session,
            assignment,
            type="resubmitted",
            actor_account_id=principal.account_id,
            actor_role="student",
            comment=body.comment,
            evidence_refs=evidence_refs,
        )
        await session.flush()
        return await serialize(session, assignment)


@router.post(
    "/assignments/{assignment_id}/appeal",
    response_model=ReviewAssignmentOut,
    operation_id="appealReviewAssignment",
)
async def appeal(request: Request, assignment_id: UUID, body: AppealRequest):
    async with authorized_transaction(request, write=True) as (session, principal):
        require_student(principal)
        assignment = await locked_assignment(session, assignment_id)
        if assignment.owner_account_id != principal.account_id:
            raise ApiError(403, "REVIEW_ACCESS_DENIED", "你无权操作该审阅请求。")
        if assignment.status not in {"approved", "changes_requested"}:
            raise ApiError(409, "REVIEW_STATUS_CONFLICT", "当前审阅还没有可申诉的结论。")
        if assignment.appeal_count >= MAX_APPEALS:
            raise ApiError(409, "APPEAL_LIMIT_REACHED", "该工单的申诉次数已达上限。")
        assignment.appeal_count += 1
        assignment.status = "in_appeal"
        assignment.updated_at = _now()
        await add_event(
            session,
            assignment,
            type="appeal",
            actor_account_id=principal.account_id,
            actor_role="student",
            comment=body.comment,
        )
        await session.flush()
        return await serialize(session, assignment)
