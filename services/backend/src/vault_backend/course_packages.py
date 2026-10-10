"""Public course payloads. Private solutions/checker fixtures do not belong here."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .code_execution import CodeRequest


class PublicRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Criterion(PublicRecord):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    verification: Literal["activity_pending", "deterministic_checker", "independent_review_pending"]


class Objective(PublicRecord):
    id: str
    code: str = Field(min_length=1)
    title: str = Field(min_length=1)
    criteria: list[Criterion] = Field(min_length=1)

    @field_validator("id")
    @classmethod
    def stable_id(cls, value: str) -> str:
        UUID(value)
        return value

    @model_validator(mode="after")
    def unique_criteria(self):
        if len({c.id for c in self.criteria}) != len(self.criteria):
            raise ValueError("Duplicate criterion")
        return self


class Outline(PublicRecord):
    kind: Literal["chapter", "unit"]
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    objective_refs: list[str] = Field(default_factory=list)
    children: list["Outline"] = Field(default_factory=list)


class Relation(PublicRecord):
    from_: str = Field(alias="from")
    to: str
    kind: Literal["mandatory_prerequisite", "conceptual_association", "application"]
    source: str = Field(min_length=1)


class Source(PublicRecord):
    id: str
    title: str
    url: str
    locator: str
    checked_at: str
    status: Literal["candidate", "located", "authority_checked", "cross_checked"]


class CodeVariant(PublicRecord):
    code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1)
    student_action: str = Field(min_length=1)
    code_request: CodeRequest
    prediction_prompt: str = Field(min_length=1)
    reflection_prompt: str = Field(min_length=1)


class Activity(PublicRecord):
    id: str
    version_id: str
    code: str
    version: str
    objective_codes: list[str] = Field(min_length=1)
    kind: Literal["structured_trace", "code", "sql", "network", "open_response"]
    student_action: str = Field(min_length=1)
    theory: list[str] = Field(min_length=1)
    starter: str
    source_refs: list[str] = Field(min_length=1)
    availability: Literal["pending", "practice_ready"]
    completion_limit: str = Field(min_length=1)
    code_request: CodeRequest | None = None
    title: str | None = None
    prediction_prompt: str | None = None
    reflection_prompt: str | None = None
    hints: list[str] = Field(default_factory=list, max_length=10)
    reference_answer: CodeRequest | None = None
    variants: list[CodeVariant] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def execution_request(self):
        if self.code_request is not None and self.kind != "code":
            raise ValueError("Only code activities may carry a code request")
        if (
            self.kind == "code"
            and self.availability == "practice_ready"
            and self.code_request is None
        ):
            raise ValueError("Ready code activities need executable starter files")
        if len({variant.code for variant in self.variants}) != len(self.variants):
            raise ValueError("Duplicate code variant")
        if self.kind != "code" and (self.reference_answer is not None or self.variants):
            raise ValueError("Only code activities may carry code variants and answers")
        return self

    @field_validator("id", "version_id")
    @classmethod
    def stable_id(cls, value: str) -> str:
        UUID(value)
        return value


class PublicCoursePackage(PublicRecord):
    schema_version: Literal["2.0.0"]
    course_id: str
    course_version_id: str
    course_code: str = Field(min_length=1)
    version: str = Field(min_length=1)
    title: str = Field(min_length=1)
    status: Literal["structured_validated", "learning_ready"]
    scope_note: str = Field(min_length=1)
    curriculum_review_state: Literal["pending", "unavailable"]
    objectives: list[Objective] = Field(min_length=1)
    outline: list[Outline] = Field(min_length=1)
    relations: list[Relation]
    activities: list[Activity]
    sources: list[Source] = Field(default_factory=list)

    @field_validator("course_id", "course_version_id")
    @classmethod
    def stable_id(cls, value: str) -> str:
        UUID(value)
        return value

    @model_validator(mode="after")
    def references(self):
        goals = {goal.code for goal in self.objectives}
        sources = {source.id for source in self.sources}
        if len(sources) != len(self.sources):
            raise ValueError("Duplicate source")
        for field in ("id", "code", "version_id"):
            values = [getattr(activity, field) for activity in self.activities]
            if len(values) != len(set(values)):
                raise ValueError("Duplicate activity identity")
        ready_goals: set[str] = set()
        for activity in self.activities:
            if not set(activity.objective_codes) <= goals:
                raise ValueError("Unknown activity objective")
            if not set(activity.source_refs) <= sources:
                raise ValueError("Unknown activity source")
            if activity.availability == "practice_ready":
                if any(
                    s.status not in {"authority_checked", "cross_checked"}
                    for s in self.sources
                    if s.id in activity.source_refs
                ):
                    raise ValueError("Practice requires checked sources")
                ready_goals.update(activity.objective_codes)
        if self.status == "learning_ready" and ready_goals != goals:
            raise ValueError("Learning-ready scope needs an activity for every goal")
        return self
