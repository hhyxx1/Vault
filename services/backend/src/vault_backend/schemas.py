from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt


class WriteModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


StackValue = Annotated[StrictInt, Field(ge=-1_000_000, le=1_000_000)]


class TraceStep(WriteModel):
    after_stack: list[StackValue] = Field(max_length=16)
    output: StackValue | None
    underflow: StrictBool


class LeaseRequest(WriteModel):
    nonce: str = Field(min_length=32, max_length=128)
    course_code: Literal["CS03", "CS05"] = "CS03"


class TraceSubmission(WriteModel):
    kind: Literal["verify_trace"] = "verify_trace"
    course_code: Literal["CS03"] = "CS03"
    activity_version: Literal["CS03-STACK-01-TRACE@0.1.0"]
    standard_version: Literal["stack-trace-v1"]
    client_artifact_id: UUID
    client_revision_id: UUID
    trace: list[TraceStep] | None = Field(default=None, min_length=7, max_length=7)
    explanation: str = Field(default="", max_length=4000)


class TruthTableRow(WriteModel):
    implication: StrictBool
    contrapositive: StrictBool
    biconditional: StrictBool


class TruthTableSubmission(WriteModel):
    kind: Literal["verify_truth_table"]
    course_code: Literal["CS05"]
    activity_version: Literal["CS05-LOGIC-01-TABLE@0.1.0"]
    standard_version: Literal["propositional-table-v1"]
    client_artifact_id: UUID
    client_revision_id: UUID
    rows: list[TruthTableRow] = Field(min_length=4, max_length=4)
    explanation: str = Field(default="", max_length=4000)


class OperationInput(WriteModel):
    op_id: UUID
    expected_revision: str = Field(pattern=r"^[1-9][0-9]*$", max_length=20)
    trace: list[TraceStep] = Field(min_length=7, max_length=7)
    explanation: str = Field(default="", max_length=4000)


class RevisionCommand(WriteModel):
    expected_revision: str = Field(pattern=r"^[1-9][0-9]*$", max_length=20)
