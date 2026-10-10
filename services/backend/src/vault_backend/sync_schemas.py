"""Bounded, explicit schemas for importing browser learning records.

These records are client reports. The historical guest checker result is preserved
as submitted content; its claimed provenance never grants platform evidence trust.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import ConfigDict, Field, StrictBool, StrictInt, field_validator, model_validator

from vault_backend.code_execution import CodeRequest, request_hash
from vault_backend.responses import (
    BracketVerificationResult,
    CodeOperationResult,
    Criterion,
    LogicCriterion,
    LogicVerificationResult,
    StructuredVerificationResult,
    TraceFeedback,
    TruthTableFeedback,
    VerificationResult,
)
from vault_backend.schemas import TraceStep, WriteModel

Hash = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
Version = Annotated[str, Field(pattern=r"^(0|[1-9][0-9]*)$", max_length=19)]
ObjectId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_.:-]+$", min_length=1, max_length=100)]
ObjectiveId = Annotated[str, Field(pattern=r"^CS[0-9]{2}-[A-Z0-9-]+$", max_length=80)]
Timestamp = Annotated[str, Field(min_length=20, max_length=40)]
ObjectType = Literal[
    "draft",
    "revision",
    "evidence",
    "help",
    "teacher_draft",
    "position",
    "personal_course",
    "personal_course_version",
    "personal_attempt",
    "personal_assist",
    "course_attempt",
    "structured_attempt",
    "code_attempt",
    "code_draft",
]


class LocalPayload(WriteModel):
    spaceId: UUID

    @field_validator("spaceId", mode="before")
    @classmethod
    def string_space_id(cls, value):
        if not isinstance(value, str):
            raise ValueError("spaceId must be a UUID string")
        return value

    @field_validator("*", mode="after", check_fields=False)
    @classmethod
    def dated_fields(cls, value, info):
        if info.field_name in {"updatedAt", "createdAt", "submittedAt", "confirmedAt"}:
            instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if instant.tzinfo is None:
                raise ValueError("timezone is required")
        return value


class LocalTraceInput(WriteModel):
    stack: str = Field(max_length=300)
    output: str = Field(max_length=32)
    underflow: StrictBool


class DraftPayload(LocalPayload):
    id: ObjectiveId
    goal: str = Field(max_length=4000)
    goalConfirmed: StrictBool
    trace: list[LocalTraceInput] = Field(max_length=100)
    explanation: str = Field(max_length=4000)
    code: str = Field(max_length=20000)
    updatedAt: Timestamp


class RevisionPayload(DraftPayload):
    artifactId: UUID
    revisionId: UUID
    version: Annotated[str, Field(pattern=r"^[1-9][0-9]*$", max_length=19)]


class HelpPayload(LocalPayload):
    id: UUID
    objectiveId: ObjectiveId
    kind: Literal["hint", "answer", "agent_assist"]
    disclosureVersion: str = Field(min_length=1, max_length=100)
    createdAt: Timestamp
    intent: Literal["diagnose", "explain", "hint", "practice", "result_feedback"] | None = None
    question: str | None = Field(default=None, max_length=1200)
    reply: str | None = Field(default=None, max_length=2500)
    nextAction: str | None = Field(default=None, max_length=500)
    revisionId: UUID | None = None
    artifactId: UUID | None = None
    courseVersion: str | None = Field(default=None, max_length=100)
    activityVersion: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_agent_record(self):
        fields = (
            self.intent,
            self.question,
            self.reply,
            self.nextAction,
            self.revisionId,
            self.artifactId,
            self.courseVersion,
            self.activityVersion,
        )
        if self.kind == "agent_assist" and any(value is None for value in fields):
            raise ValueError(
                "agent assistance records must retain request, reply and revision context"
            )
        if self.kind != "agent_assist" and any(value is not None for value in fields):
            raise ValueError("agent fields require kind=agent_assist")
        return self


class ImportedCriterion(Criterion):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(max_length=2000)


class ImportedTraceFeedback(TraceFeedback):
    model_config = ConfigDict(extra="forbid")
    index: Annotated[StrictInt, Field(ge=1, le=100)]
    correct: StrictBool
    issues: list[Annotated[str, Field(max_length=1000)]] = Field(max_length=20)


class ImportedResult(VerificationResult):
    model_config = ConfigDict(extra="forbid")
    objective_ids: list[UUID] = Field(max_length=100)
    course_version: str = Field(max_length=100)
    activity_version: str = Field(max_length=100)
    standard_version: str = Field(max_length=100)
    checker_version: str = Field(max_length=100)
    runtime: str = Field(max_length=100)
    summary: str = Field(max_length=4000)
    trace_correct: StrictBool
    mastery_asserted: Literal[False]
    rows: list[ImportedTraceFeedback] = Field(max_length=100)
    criteria: list[ImportedCriterion] = Field(max_length=20)

    @field_validator("mastery_asserted", mode="before")
    @classmethod
    def no_mastery_claim(cls, value):
        if value is not False:
            raise ValueError("historical checker cannot assert mastery")
        return value


class SubmittedWork(WriteModel):
    trace: list[TraceStep] = Field(max_length=100)
    explanation: str = Field(max_length=4000)


class EvidencePayload(LocalPayload):
    id: UUID
    objectiveId: ObjectiveId
    revisionId: UUID
    revisionVersion: Annotated[str, Field(pattern=r"^[1-9][0-9]*$", max_length=19)]
    submittedAt: Timestamp
    submittedWork: SubmittedWork
    createdAt: Timestamp
    result: ImportedResult
    helpEventIds: list[UUID] = Field(max_length=200)


class LocalTruthCell(WriteModel):
    implication: StrictBool | None
    contrapositive: StrictBool | None
    biconditional: StrictBool | None


class ImportedTruthTableFeedback(TruthTableFeedback):
    model_config = ConfigDict(extra="forbid")
    index: Annotated[StrictInt, Field(ge=1, le=4)]
    p: StrictBool
    q: StrictBool
    correct: StrictBool
    issues: list[Literal["implication", "contrapositive", "biconditional"]] = Field(max_length=3)


class ImportedLogicCriterion(LogicCriterion):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(max_length=2000)


class ImportedLogicResult(LogicVerificationResult):
    model_config = ConfigDict(extra="forbid")
    objective_ids: list[UUID] = Field(max_length=10)
    course_version: str = Field(max_length=100)
    activity_version: str = Field(max_length=100)
    standard_version: str = Field(max_length=100)
    checker_version: str = Field(max_length=100)
    runtime: str = Field(max_length=100)
    summary: str = Field(max_length=4000)
    rows: list[ImportedTruthTableFeedback] = Field(min_length=4, max_length=4)
    criteria: list[ImportedLogicCriterion] = Field(min_length=5, max_length=5)
    mastery_asserted: Literal[False]

    @field_validator("mastery_asserted", mode="before")
    @classmethod
    def no_logic_mastery_claim(cls, value):
        if value is not False:
            raise ValueError("historical checker cannot assert mastery")
        return value


class CourseAttemptPayload(LocalPayload):
    id: UUID
    artifactId: UUID
    objectiveId: Literal["CS05-LOGIC-01"]
    courseCode: Literal["CS05"]
    activityVersion: Literal["CS05-LOGIC-01-TABLE@0.1.0"]
    rows: list[LocalTruthCell] = Field(min_length=4, max_length=4)
    explanation: str = Field(max_length=4000)
    result: ImportedLogicResult | None = None
    createdAt: Timestamp
    updatedAt: Timestamp
    submittedAt: Timestamp | None = None

    @model_validator(mode="after")
    def result_matches_attempt(self):
        if self.result is not None and (
            self.submittedAt is None
            or self.result.client_artifact_id != self.artifactId
            or self.result.client_revision_id != self.id
            or self.result.course_code != self.courseCode
            or self.result.activity_version != self.activityVersion
            or any(value is None for row in self.rows for value in row.model_dump().values())
        ):
            raise ValueError("checker result does not match the submitted attempt")
        return self


class LocalStructuredRow(WriteModel):
    state: dict[Annotated[str, Field(max_length=30)], Annotated[str, Field(max_length=2000)]] = (
        Field(max_length=8)
    )
    value: str = Field(max_length=100)
    status: Literal["", "ok", "underflow", "full"]


class LocalBracketRow(WriteModel):
    case: str = Field(max_length=100)
    matched: Literal["", "matched", "mismatch"]
    mismatchIndex: str = Field(max_length=100)


class StructuredAttemptPayload(LocalPayload):
    id: UUID
    artifactId: UUID
    objectiveCode: ObjectiveId
    courseCode: Literal["CS03"]
    activityVersion: str = Field(max_length=100)
    kind: Literal["structured_trace", "bracket_judgement"]
    traceRows: list[LocalStructuredRow] = Field(max_length=32)
    bracketRows: list[LocalBracketRow] = Field(max_length=16)
    explanation: str = Field(max_length=4000)
    result: dict[str, Any] | None = None
    createdAt: Timestamp
    updatedAt: Timestamp
    submittedAt: Timestamp | None = None

    @model_validator(mode="after")
    def bounded_activity(self):
        from vault_backend.course_checks.brackets import (
            BRACKET_ACTIVITY_VERSION,
            BRACKET_CASES,
            BRACKET_CONTEXT,
        )
        from vault_backend.course_checks.structured_trace import TRUSTED_TRACE_SPECS

        # Only registered public activities can be restored, never uploaded checkers.
        if self.kind == "structured_trace":
            spec = TRUSTED_TRACE_SPECS.get(self.activityVersion)
            if spec is None or self.bracketRows or len(self.traceRows) != len(spec.operations):
                raise ValueError("unknown activity or invalid row count")
            if any(set(row.state) != set(spec.state_fields) for row in self.traceRows):
                raise ValueError("invalid state fields")
            context = spec.context
            result_model = StructuredVerificationResult
        else:
            if self.activityVersion != BRACKET_ACTIVITY_VERSION or self.traceRows:
                raise ValueError("unknown bracket activity")
            if [row.case for row in self.bracketRows] != list(BRACKET_CASES):
                raise ValueError("invalid bracket cases")
            context = BRACKET_CONTEXT
            result_model = BracketVerificationResult
        # Resolve objective codes from the public package, not a duplicated code map.
        from vault_backend.config import Settings
        from vault_backend.content import CourseRepository

        package = CourseRepository(Settings().course_catalog_path).example
        if package is None:
            raise ValueError("course package unavailable")
        objectives = {item["id"]: item["code"] for item in package["objectives"]}
        if self.objectiveCode not in [objectives[str(key)] for key in context["objective_ids"]]:
            raise ValueError("activity objective mismatch")
        if self.result is not None:
            if self.submittedAt is None or self.result.get("mastery_asserted") is not False:
                raise ValueError("invalid submitted historical result")
            # Historical report content stays client_reported; validation grants no trust.
            result = result_model.model_validate(self.result)
            if set(self.result) != set(result_model.model_fields):
                raise ValueError("unexpected result fields")
            if (
                result.client_artifact_id != self.artifactId
                or result.client_revision_id != self.id
                or result.activity_version != self.activityVersion
            ):
                raise ValueError("result identity mismatch")
            for key in ("course_id", "course_version_id", "activity_id", "activity_version_id"):
                if str(getattr(result, key)) != str(context[key]):
                    raise ValueError("result context mismatch")
        return self


class TeacherDraftPayload(LocalPayload):
    id: UUID
    title: str = Field(max_length=200)
    outline: str = Field(max_length=20000)
    studentVisible: Literal[False]
    updatedAt: Timestamp

    @field_validator("studentVisible", mode="before")
    @classmethod
    def private_only(cls, value):
        if value is not False:
            raise ValueError("private draft cannot be published by sync")
        return value


class PositionPayload(LocalPayload):
    id: Literal["learning-position"]
    lastObjective: ObjectiveId | None
    updatedAt: Timestamp


class PersonalTopic(WriteModel):
    id: UUID
    title: str = Field(min_length=1, max_length=120)
    expectedPerformance: str = Field(min_length=1, max_length=500)

    @field_validator("title", "expectedPerformance")
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("topic text cannot be blank")
        return value


class PersonalCoursePayload(LocalPayload):
    id: UUID
    title: str = Field(min_length=1, max_length=120)
    goal: str = Field(max_length=2000)
    topics: list[PersonalTopic] = Field(max_length=64)
    createdAt: Timestamp
    updatedAt: Timestamp

    @field_validator("title")
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("course text cannot be blank")
        return value

    @field_validator("goal")
    @classmethod
    def optional_goal(cls, value: str) -> str:
        if value and not value.strip():
            raise ValueError("course goal must be blank or meaningful")
        return value

    @model_validator(mode="after")
    def unique_topics(self):
        if len({topic.id for topic in self.topics}) != len(self.topics):
            raise ValueError("topic IDs must be unique within the course")
        return self


class PersonalCourseVersionPayload(LocalPayload):
    id: UUID
    courseId: UUID
    version: StrictInt = Field(ge=1, le=1_000_000)
    title: str = Field(min_length=1, max_length=120)
    goal: str = Field(max_length=2000)
    topics: list[PersonalTopic] = Field(max_length=64)
    scopeStatus: Literal["exploration", "defined"]
    gaps: list[Literal["goal", "learning_points"]] = Field(max_length=2)
    confirmedAt: Timestamp

    @field_validator("title")
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("scope title cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_scope_snapshot(self):
        if len({topic.id for topic in self.topics}) != len(self.topics):
            raise ValueError("topic IDs must be unique within the course scope version")
        expected_gaps = []
        if not self.goal.strip():
            expected_gaps.append("goal")
        if not self.topics:
            expected_gaps.append("learning_points")
        expected_status = "defined" if not expected_gaps else "exploration"
        if self.gaps != expected_gaps or self.scopeStatus != expected_status:
            raise ValueError("scope status and gaps must match the confirmed snapshot")
        return self


class PersonalAttemptPayload(LocalPayload):
    id: UUID
    courseId: UUID
    topicId: UUID
    scopeVersionId: UUID | None = None
    learningQuestion: str = Field(min_length=1, max_length=1200)
    theoryNote: str = Field(min_length=1, max_length=4000)
    action: str = Field(min_length=1, max_length=4000)
    observation: str = Field(min_length=1, max_length=4000)
    reflection: str = Field(min_length=1, max_length=4000)
    nextStep: str = Field(min_length=1, max_length=4000)
    createdAt: Timestamp

    @field_validator(
        "learningQuestion", "theoryNote", "action", "observation", "reflection", "nextStep"
    )
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("attempt text cannot be blank")
        return value


class PersonalAssistPayload(LocalPayload):
    id: UUID
    courseId: UUID
    scopeVersionId: UUID
    topicId: UUID
    attemptId: UUID
    intent: Literal["diagnose", "explain", "hint", "practice"]
    question: str = Field(min_length=1, max_length=1200)
    reply: str = Field(min_length=1, max_length=2500)
    nextAction: str = Field(min_length=1, max_length=500)
    modelProfileId: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,39}$")
    provider: str = Field(min_length=1, max_length=120)
    disclosureVersion: Literal["personal-learning-assist-v1"]
    createdAt: Timestamp

    @field_validator("question", "reply", "nextAction", "provider")
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("personal assistance text cannot be blank")
        return value


class TombstonePayload(WriteModel):
    deleted: Literal[True]


class ImportedCodeResult(CodeOperationResult):
    model_config = ConfigDict(extra="forbid", strict=True)
    client_artifact_id: UUID = Field(strict=False)
    client_revision_id: UUID = Field(strict=False)
    stdout: str = Field(max_length=8192)
    stderr: str = Field(max_length=8192)
    runtime_profile: str = Field(min_length=1, max_length=100)
    request_sha256: Hash
    metadata: dict[str, str] = Field(max_length=32)

    @model_validator(mode="after")
    def bounded_metadata(self):
        if any(len(k) > 100 or len(v) > 1000 for k, v in self.metadata.items()):
            raise ValueError("execution metadata exceeds import limits")
        return self


class CodeLearningContext(WriteModel):
    courseId: UUID
    courseVersionId: UUID
    activityVersionId: UUID
    objectiveCode: str = Field(min_length=1, max_length=80)
    taskCode: str = Field(min_length=1, max_length=100)
    helpViewed: list[str] = Field(max_length=20)

    @field_validator("helpViewed")
    @classmethod
    def bounded_help(cls, values):
        if any(not value or len(value) > 100 for value in values) or len(set(values)) != len(
            values
        ):
            raise ValueError("help references must be bounded and unique")
        return values


class CodeLearningSnapshot(WriteModel):
    context: CodeLearningContext | None
    prediction: str = Field(max_length=4000)


class CodeDraftPayload(LocalPayload):
    id: Hash
    activityKey: str = Field(min_length=1, max_length=200)
    request: CodeRequest
    prediction: str = Field(max_length=4000)
    reflection: str = Field(max_length=4000)
    learningContext: CodeLearningContext | None
    createdAt: Timestamp
    updatedAt: Timestamp
    viewedRevisionId: UUID | None = None
    reflectionRevisionId: UUID | None = None
    reflections: dict[str, str] = Field(default_factory=dict, max_length=50)

    @field_validator("reflections")
    @classmethod
    def bounded_revision_notes(cls, values):
        for key, note in values.items():
            UUID(key)
            if len(note) > 4000:
                raise ValueError("revision note is too long")
        return values


class CodeAttemptPayload(LocalPayload):
    id: UUID
    artifactId: UUID
    activityKey: str = Field(min_length=1, max_length=200)
    request: CodeRequest
    requestHash: Hash
    result: ImportedCodeResult | None = None
    createdAt: Timestamp
    updatedAt: Timestamp
    learning: CodeLearningSnapshot | None = None

    @model_validator(mode="after")
    def bind_work(self):
        if request_hash(self.request) != self.requestHash:
            raise ValueError("source and request hash differ")
        if self.result and (
            self.result.client_revision_id != self.id
            or self.result.client_artifact_id != self.artifactId
            or self.result.request_sha256 != self.requestHash
            or self.result.mastery_asserted is not False
        ):
            raise ValueError("result must match the submitted code version")
        check = self.result.task_assessment if self.result else None
        if check:
            context = self.learning.context if self.learning else None
            if not context or (
                check.course_version_id != str(context.courseVersionId)
                or check.activity_version_id != str(context.activityVersionId)
                or check.objective_code != context.objectiveCode
                or check.task_code != context.taskCode
            ):
                raise ValueError("task assessment must match the frozen learning context")
            if {c.id for c in check.criteria} != {
                "fixed_condition",
                "explanation",
                "independent_transfer",
            } or any(
                c.status != "needs_review" for c in check.criteria if c.id != "fixed_condition"
            ):
                raise ValueError("fixed-condition checks cannot grant independent mastery")
        return self


PAYLOAD_MODELS = {
    "draft": DraftPayload,
    "revision": RevisionPayload,
    "evidence": EvidencePayload,
    "help": HelpPayload,
    "teacher_draft": TeacherDraftPayload,
    "position": PositionPayload,
    "personal_course": PersonalCoursePayload,
    "personal_course_version": PersonalCourseVersionPayload,
    "personal_attempt": PersonalAttemptPayload,
    "personal_assist": PersonalAssistPayload,
    "course_attempt": CourseAttemptPayload,
    "structured_attempt": StructuredAttemptPayload,
    "code_attempt": CodeAttemptPayload,
    "code_draft": CodeDraftPayload,
}


class ClaimRequest(WriteModel):
    claim_id: UUID
    expected_account_id: UUID
    origin_local_space_id: UUID
    manifest_hash: Hash


class ClaimResponse(ClaimRequest):
    server_space_id: UUID
    state: Literal["committed"] = "committed"
    committed_at: datetime


class SyncOperation(WriteModel):
    op_id: UUID
    object_type: ObjectType | Literal["attachment"]
    object_id: ObjectId
    base_version: Version
    payload_hash: Hash
    # Runtime validates against exactly one PAYLOAD_MODELS entry before persisting.
    # The dict lets malformed individual records receive a per-item rejection;
    # it never enables arbitrary JSON storage.
    payload: dict[str, Any]

    @field_validator("base_version")
    @classmethod
    def bounded_version(cls, value):
        if int(value) > 9_223_372_036_854_775_806:
            raise ValueError("version exceeds PostgreSQL bigint")
        return value


class BatchRequest(WriteModel):
    expected_account_id: UUID
    batch_id: UUID
    operations: list[SyncOperation] = Field(min_length=1, max_length=50)

    @field_validator("operations")
    @classmethod
    def unique_ops(cls, value):
        if len({item.op_id for item in value}) != len(value):
            raise ValueError("duplicate op_id in one batch")
        return value


class OperationResult(WriteModel):
    op_id: UUID
    object_type: ObjectType | Literal["attachment"]
    object_id: str
    status: Literal["applied", "already_applied", "conflict", "rejected", "dependency_pending"]
    current_version: Version
    reason: str | None = None
    conflict_id: UUID | None = None


class BatchResponse(WriteModel):
    batch_id: UUID
    space_id: UUID
    results: list[OperationResult]
    cursor: None = None


class SpaceResponse(WriteModel):
    space_id: UUID
    origin_local_space_id: UUID
    kind: Literal["personal"]
    bound_at: datetime
    version: Version


class SpacesResponse(WriteModel):
    spaces: list[SpaceResponse]


class ChangeResponse(WriteModel):
    sequence: Version
    object_type: ObjectType
    object_id: str
    server_object_id: UUID
    version: Version
    deleted: bool
    payload: dict[str, Any] | None
    payload_hash: Hash
    provenance: Literal["client_reported"] = "client_reported"
    requires_review: bool


class ChangesResponse(WriteModel):
    space_id: UUID
    changes: list[ChangeResponse]
    next_cursor: str
    has_more: bool


class ConflictResponse(WriteModel):
    conflict_id: UUID
    object_type: ObjectType
    object_id: str
    base_version: Version
    current_version: Version
    incoming_payload: dict[str, Any]
    payload_hash: Hash
    created_at: datetime
    provenance: Literal["client_reported"] = "client_reported"


class ConflictsResponse(WriteModel):
    space_id: UUID
    conflicts: list[ConflictResponse]
