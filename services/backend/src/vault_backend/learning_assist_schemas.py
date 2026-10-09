from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from vault_backend.checker import STACK_COURSE_VERSION
from vault_backend.schemas import WriteModel


class LearningAssistRequest(WriteModel):
    request_id: UUID
    model_profile_id: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_-]{0,39}$")
    course_code: Literal["CS03"]
    course_version: Literal[STACK_COURSE_VERSION]
    activity_version: Literal["CS03-STACK-01-TRACE@0.1.0"]
    objective_code: Literal["CS03-STACK-01"]
    intent: Literal["diagnose", "explain", "hint", "practice", "result_feedback"]
    disclosure_accepted: Literal[True]
    artifact_id: UUID
    revision_id: UUID
    goal: str = Field(min_length=1, max_length=2000)
    question: str = Field(default="", max_length=1200)
    work_excerpt: str = Field(default="", max_length=4000)
    explanation: str = Field(default="", max_length=4000)
    operation_id: UUID | None = None


class PersonalLearningAssistRequest(WriteModel):
    request_id: UUID
    model_profile_id: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_-]{0,39}$")
    course_id: UUID
    scope_version_id: UUID
    topic_id: UUID
    attempt_id: UUID
    course_title: str = Field(min_length=1, max_length=120)
    course_goal: str = Field(max_length=2000)
    topic_title: str = Field(min_length=1, max_length=120)
    expected_performance: str = Field(min_length=1, max_length=500)
    attempt_excerpt: str = Field(min_length=1, max_length=4000)
    question: str = Field(min_length=1, max_length=1200)
    intent: Literal["diagnose", "explain", "hint", "practice"]
    disclosure_accepted: Literal[True]

    @field_validator(
        "course_title", "topic_title", "expected_performance", "attempt_excerpt", "question"
    )
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("personal learning context cannot be blank")
        return value


class LearningAssistReply(WriteModel):
    message: str = Field(min_length=1, max_length=2500)
    next_action: str = Field(min_length=1, max_length=500)
    mastery_asserted: Literal[False] = False
