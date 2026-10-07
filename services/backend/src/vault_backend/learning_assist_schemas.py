from typing import Literal
from uuid import UUID

from pydantic import Field

from vault_backend.schemas import WriteModel


class LearningAssistRequest(WriteModel):
    request_id: UUID
    model_profile_id: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_-]{0,39}$")
    course_code: Literal["CS03"]
    course_version: Literal["CS03-example-0.1.0"]
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


class LearningAssistReply(WriteModel):
    message: str = Field(min_length=1, max_length=2500)
    next_action: str = Field(min_length=1, max_length=500)
    mastery_asserted: Literal[False] = False
