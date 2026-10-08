"""Bounded, explicit schemas for importing browser learning records.

These records are client reports. The historical guest checker result is preserved
as submitted content; its claimed provenance never grants platform evidence trust.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import ConfigDict, Field, StrictBool, StrictInt, field_validator, model_validator

from vault_backend.responses import Criterion, TraceFeedback, VerificationResult
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
