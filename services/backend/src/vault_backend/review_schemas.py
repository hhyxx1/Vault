"""Schemas for the human review and appeal workflow.

A student submission can only cite rule results, model suggestions and the
student's own account. Authorized-teacher opinions and professional review are
never accepted from the client; they are produced server-side by a verified
teacher session (professional review remains an external, unstaffed gate).
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from vault_backend.schemas import WriteModel

Hash = Field(pattern=r"^[0-9a-f]{64}$")
RubricKind = Literal["objective", "explanation", "independent_transfer"]
RubricStatus = Literal["met", "not_met", "needs_review"]
# Sources a student is allowed to attach when requesting review. Teacher and
# professional provenance are deliberately absent.
StudentEvidenceKind = Literal["server_tool", "model_suggestion", "student_self"]
Audience = Literal["platform_teachers", "specific_teacher"]
Decision = Literal["approved", "changes_requested"]


class RubricCriterionIn(WriteModel):
    id: str = Field(min_length=1, max_length=60, pattern=r"^[A-Za-z0-9_.:-]+$")
    title: str = Field(min_length=1, max_length=200)
    kind: RubricKind


class EvidenceItemIn(WriteModel):
    kind: StudentEvidenceKind
    summary: str = Field(min_length=1, max_length=2000)


class ReviewCreateRequest(WriteModel):
    assignment_id: UUID
    expected_account_id: UUID
    space_id: UUID
    audience: Audience = "platform_teachers"
    teacher_account_id: UUID | None = None
    course_code: str = Field(min_length=1, max_length=32)
    course_version_id: UUID | None = None
    objective_code: str = Field(min_length=1, max_length=80)
    activity_version: str = Field(min_length=1, max_length=120)
    artifact_id: UUID
    artifact_revision_id: UUID
    artifact_hash: str = Hash
    rubric: list[RubricCriterionIn] = Field(min_length=1, max_length=12)
    evidence_snapshot: list[EvidenceItemIn] = Field(default_factory=list, max_length=20)
    student_note: str | None = Field(default=None, max_length=2000)

    @field_validator("teacher_account_id")
    @classmethod
    def specific_teacher_named(cls, value, info):
        audience = info.data.get("audience")
        if audience == "specific_teacher" and value is None:
            raise ValueError("specific_teacher audience requires teacher_account_id")
        return value


class RubricResultIn(WriteModel):
    id: str = Field(min_length=1, max_length=60, pattern=r"^[A-Za-z0-9_.:-]+$")
    status: RubricStatus
    # A human reason is required for every criterion, but the service never
    # scores by word count or keywords.
    note: str = Field(min_length=1, max_length=1000)


class DecisionRequest(WriteModel):
    decision: Decision
    rubric_results: list[RubricResultIn] = Field(min_length=1, max_length=12)
    comment: str = Field(min_length=1, max_length=2000)


class EvidenceRefIn(WriteModel):
    artifact_revision_id: UUID
    artifact_hash: str = Hash
    note: str = Field(min_length=1, max_length=1000)


class ResubmitRequest(WriteModel):
    comment: str = Field(min_length=1, max_length=2000)
    evidence_refs: list[EvidenceRefIn] = Field(min_length=1, max_length=10)


class AppealRequest(WriteModel):
    comment: str = Field(min_length=1, max_length=2000)


class TeacherNoteRequest(WriteModel):
    comment: str = Field(min_length=1, max_length=2000)


class ReviewEventOut(BaseModel):
    id: UUID
    sequence: int
    type: str
    actor_account_id: UUID
    actor_role: str
    decision: str | None = None
    rubric_results: list | None = None
    comment: str | None = None
    evidence_refs: list | None = None
    teacher_signature: dict | None = None
    created_at: str


class ReviewAssignmentOut(BaseModel):
    id: UUID
    space_id: UUID
    owner_account_id: UUID
    audience: str
    teacher_account_id: UUID | None = None
    course_code: str
    course_version_id: UUID | None = None
    objective_code: str
    activity_version: str
    artifact_id: UUID
    artifact_revision_id: UUID
    artifact_hash: str
    rubric: list
    evidence_snapshot: list
    work_snapshot: list = Field(default=list)
    status: str
    claimed_by_account_id: UUID | None = None
    review_service_available: bool
    appeal_count: int
    created_at: str
    updated_at: str
    events: list[ReviewEventOut] = Field(default=list)


class ReviewListOut(BaseModel):
    assignments: list[ReviewAssignmentOut]


MAX_APPEALS = 2
