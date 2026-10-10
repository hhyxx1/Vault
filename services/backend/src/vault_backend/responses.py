from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from vault_backend.code_execution import CodeResult


class NonceResponse(BaseModel):
    nonce: str
    expires_at: datetime


class LeaseResponse(BaseModel):
    lease_id: UUID
    token: str
    created_at: datetime
    idle_expires_at: datetime
    absolute_expires_at: datetime
    allowed_operations: list[
        Literal[
            "verify_trace",
            "verify_truth_table",
            "verify_structured_trace",
            "verify_bracket_judgement",
            "learning_assist",
            "run_code",
        ]
    ]
    storage: Literal["ephemeral_memory"]


class Criterion(BaseModel):
    id: Literal["state_trace", "boundary_condition", "explanation", "independent_transfer"]
    status: Literal["met", "not_met", "needs_review"]
    reason: str


class TraceFeedback(BaseModel):
    index: int
    correct: bool
    issues: list[str]


class VerificationResult(BaseModel):
    verification_id: UUID
    course_id: UUID
    course_version_id: UUID
    activity_id: UUID
    activity_version_id: UUID
    objective_ids: list[UUID]
    course_code: Literal["CS03"]
    course_version: str
    activity_version: str
    standard_version: str
    client_artifact_id: UUID
    client_revision_id: UUID
    artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    checker_version: str
    runtime: str
    provenance: Literal["server_deterministic_checker"]
    trace_correct: bool
    rows: list[TraceFeedback]
    criteria: list[Criterion]
    objective_state: Literal["evidence_pending_review", "practicing"]
    mastery_asserted: Literal[False]
    summary: str


class StructuredCriterion(BaseModel):
    id: str
    title: str
    status: Literal["met", "not_met", "needs_review"]
    reason: str


class StructuredVerificationResult(BaseModel):
    verification_id: UUID
    course_id: UUID
    course_version_id: UUID
    activity_id: UUID
    activity_version_id: UUID
    objective_ids: list[UUID]
    course_code: Literal["CS03"]
    course_version: str
    activity_version: str
    standard_version: str
    client_artifact_id: UUID
    client_revision_id: UUID
    artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    checker_version: str
    runtime: str
    provenance: Literal["server_deterministic_checker"]
    trace_correct: bool
    rows: list[TraceFeedback]
    criteria: list[StructuredCriterion]
    objective_state: Literal["evidence_pending_review", "practicing"]
    mastery_asserted: Literal[False]
    summary: str


class BracketFeedback(BaseModel):
    index: int
    case: str
    correct: bool
    issues: list[str]


class BracketVerificationResult(BaseModel):
    verification_id: UUID
    course_id: UUID
    course_version_id: UUID
    activity_id: UUID
    activity_version_id: UUID
    objective_ids: list[UUID]
    course_code: Literal["CS03"]
    course_version: str
    activity_version: str
    standard_version: str
    client_artifact_id: UUID
    client_revision_id: UUID
    artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    checker_version: str
    runtime: str
    provenance: Literal["server_deterministic_checker"]
    bracket_correct: bool
    rows: list[BracketFeedback]
    criteria: list[StructuredCriterion]
    objective_state: Literal["evidence_pending_review", "practicing"]
    mastery_asserted: Literal[False]
    summary: str


class TruthTableFeedback(BaseModel):
    index: int
    p: bool
    q: bool
    correct: bool
    issues: list[Literal["implication", "contrapositive", "biconditional"]]
    expected: dict[str, bool]


class LogicCriterion(BaseModel):
    id: Literal[
        "implication", "contrapositive", "biconditional", "explanation", "independent_transfer"
    ]
    status: Literal["met", "not_met", "needs_review"]
    reason: str


class LogicVerificationResult(BaseModel):
    verification_id: UUID
    course_id: UUID
    course_version_id: UUID
    activity_id: UUID
    activity_version_id: UUID
    objective_ids: list[UUID]
    course_code: Literal["CS05"]
    course_version: str
    activity_version: str
    standard_version: str
    client_artifact_id: UUID
    client_revision_id: UUID
    artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    checker_version: str
    runtime: str
    provenance: Literal["server_deterministic_checker"]
    truth_correct: bool
    rows: list[TruthTableFeedback]
    criteria: list[LogicCriterion]
    objective_state: Literal["evidence_pending_review", "practicing"]
    mastery_asserted: Literal[False]
    summary: str


class CodeOperationResult(CodeResult):
    client_artifact_id: UUID
    client_revision_id: UUID


class OperationResponse(BaseModel):
    operation_id: UUID
    lease_id: UUID
    kind: Literal[
        "verify_trace",
        "verify_truth_table",
        "verify_structured_trace",
        "verify_bracket_judgement",
        "run_code",
    ]
    status: Literal[
        "awaiting_input", "running", "cancelling", "completed", "cancelled", "acknowledged"
    ]
    revision: str
    result: (
        VerificationResult
        | LogicVerificationResult
        | StructuredVerificationResult
        | BracketVerificationResult
        | CodeOperationResult
        | None
    )
    storage: Literal["ephemeral_memory"]
    acknowledged: bool


class CatalogCourse(BaseModel):
    id: UUID
    code: str
    title: str
    version_id: UUID
    version: str
    origin_kind: Literal["platform_default"]
    content_state: Literal["planned", "engineering_example"]
    full_course_available: Literal[False]
    scope_note: str
    activities_scope: str
    verification_scope: str
    environment_boundary: str
    count_scope: Literal["not_available", "engineering_example"]
    objective_count: int | None


class CourseCatalog(BaseModel):
    schema_version: str
    catalog_version: str
    courses: list[CatalogCourse]
