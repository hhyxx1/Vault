"""Human review and appeal workflow for a single frozen student work version.

A review assignment is created only by the owning student and grants a teacher
access to exactly one artifact revision. Teachers never browse a student's
space. Nothing is auto-claimed and no teacher signature exists unless a
verified-teacher session records the decision; when no verified teacher is
staffed the assignment stays unassigned and reports the service as unavailable.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Request
from sqlalchemy import func, select, text

from vault_backend.auth import authorized_transaction
from vault_backend.errors import ApiError
from vault_backend.models import ReviewAssignment, ReviewEvent, TeacherProfile
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
from vault_backend.sync import own_space

router = APIRouter(prefix="/api/v1/reviews", tags=["Human review"])

_STUDENT_SOURCE_KINDS = {"server_tool", "model_suggestion", "student_self"}
_DECISION_STATES = {"claimed", "resubmitted", "in_appeal"}


def _now() -> datetime:
    return datetime.now(UTC)


def require_student(principal) -> None:
    if principal.account_type != "student":
        raise ApiError(403, "STUDENT_ACCOUNT_REQUIRED", "只有学生账号可以提交作品审阅请求。")


def require_verified_teacher(principal) -> None:
    if (
        principal.account_type != "teacher"
        or principal.teacher_verification_state != "verified"
    ):
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
        select(ReviewAssignment)
        .where(ReviewAssignment.id == assignment_id)
        .with_for_update()
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
        existing = await session.get(ReviewAssignment, body.assignment_id)
        if existing is not None:
            if (
                existing.space_id != body.space_id
                or existing.artifact_revision_id != body.artifact_revision_id
                or existing.objective_code != body.objective_code
            ):
                raise ApiError(
                    409, "IDEMPOTENCY_CONFLICT", "该审阅请求已固定为另一份作品或目标。"
                )
            return await serialize(session, existing)
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
            rubric=[item.model_dump(mode="json") for item in body.rubric],
            evidence_snapshot=[
                item.model_dump(mode="json") for item in body.evidence_snapshot
            ],
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
        is_teacher = principal.account_type == "teacher" and (
            principal.teacher_verification_state == "verified"
        ) and teacher_authorized(assignment, principal.account_id)
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
            row
            for row in available_rows
            if teacher_authorized(row, principal.account_id)
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
        if received != expected_ids:
            raise ApiError(
                422,
                "RUBRIC_MISMATCH",
                "必须对工单中的每一条 rubric 逐项给出判定，且不能增加条目。",
            )
        profile = await session.get(TeacherProfile, principal.account_id)
        display_name = profile.display_name if profile is not None else ""
        signature = {
            "teacher_account_id": str(principal.account_id),
            "display_name": display_name,
            "verification_state": "verified",
            "signed_at": _now().isoformat(),
        }
        assignment.status = (
            "approved" if body.decision == "approved" else "changes_requested"
        )
        assignment.updated_at = _now()
        await add_event(
            session,
            assignment,
            type="decision",
            actor_account_id=principal.account_id,
            actor_role="teacher",
            decision=body.decision,
            rubric_results=[
                result.model_dump(mode="json") for result in body.rubric_results
            ],
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
        assignment.status = "resubmitted"
        assignment.updated_at = _now()
        await add_event(
            session,
            assignment,
            type="resubmitted",
            actor_account_id=principal.account_id,
            actor_role="student",
            comment=body.comment,
            evidence_refs=[item.model_dump(mode="json") for item in body.evidence_refs],
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
