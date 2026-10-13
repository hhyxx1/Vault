from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

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


class CourseDiscoveryTurn(WriteModel):
    role: Literal["learner", "assistant"]
    content: str = Field(min_length=1, max_length=1200)


class CourseDiscoveryRequest(WriteModel):
    request_id: UUID
    model_profile_id: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_-]{0,39}$")
    course_name: str = Field(min_length=1, max_length=120)
    learning_goal: str = Field(default="", max_length=2000)
    current_knowledge: str = Field(default="", max_length=1200)
    turns: list[CourseDiscoveryTurn] = Field(default_factory=list, max_length=10)
    disclosure_accepted: Literal[True]

    @field_validator("course_name")
    @classmethod
    def course_name_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("course name cannot be blank")
        return value


class CourseTopicProposal(WriteModel):
    title: str = Field(min_length=1, max_length=120)
    expected_performance: str = Field(min_length=1, max_length=500)


class CourseProposal(WriteModel):
    title: str = Field(min_length=1, max_length=120)
    goal: str = Field(min_length=1, max_length=2000)
    topics: list[CourseTopicProposal] = Field(min_length=3, max_length=8)
    first_task: str = Field(min_length=1, max_length=800)
    assumptions: list[str] = Field(default_factory=list, max_length=8)


class CourseDiscoveryReply(WriteModel):
    status: Literal["clarifying", "draft"]
    message: str = Field(min_length=1, max_length=1500)
    clarifying_question: str | None = Field(default=None, max_length=500)
    proposal: CourseProposal | None = None
    mastery_asserted: Literal[False] = False
    content_review_status: Literal["unreviewed_ai_draft"] = "unreviewed_ai_draft"

    @model_validator(mode="after")
    def status_matches_content(self):
        if self.status == "clarifying" and (not self.clarifying_question or self.proposal):
            raise ValueError("clarifying replies need a question and cannot contain a course draft")
        if self.status == "draft" and (self.clarifying_question or not self.proposal):
            raise ValueError("draft replies need a proposal and cannot ask a blocking question")
        return self


class LearningAssistReply(WriteModel):
    message: str = Field(min_length=1, max_length=2500)
    next_action: str = Field(min_length=1, max_length=500)
    mastery_asserted: Literal[False] = False
