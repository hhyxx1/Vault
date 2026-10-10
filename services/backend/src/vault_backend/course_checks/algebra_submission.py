"""Bounded native-table work validation; no execution of user supplied code.

This checker is internal until an immutable published activity registers it.
It grades predictions about the submitted tables, not whether every table is a
positive example. Context and server verification IDs belong to that registry.
"""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

from vault_backend.checker import canonical_hash
from vault_backend.course_checks.finite_algebra import group, homomorphism, ring, validate

Element = Annotated[StrictInt, Field(ge=-1_000_000, le=1_000_000)]
TableRow = Annotated[list[Element], Field(min_length=1, max_length=12)]
OperationTable = Annotated[list[TableRow], Field(min_length=1, max_length=12)]
KEYS = {
    "group": {"closed", "associative", "is_group"},
    "ring": {"ring", "unital_ring", "field"},
    "homomorphism": {"preserves_operation", "injective", "surjective", "is_group_isomorphism"},
}


class AlgebraWork(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["group", "ring", "homomorphism"]
    table: OperationTable
    second_table: OperationTable | None = None
    mapping: list[Element] | None = Field(default=None, min_length=1, max_length=12)
    predictions: dict[str, StrictBool] = Field(min_length=3, max_length=4)
    explanation: str = Field(default="", max_length=4000)
    client_artifact_id: UUID
    client_revision_id: UUID

    @model_validator(mode="after")
    def complete_work(self):
        n = validate(self.table)
        if set(self.predictions) != KEYS[self.mode]:
            raise ValueError("predictions must match the selected experiment")
        if self.mode == "group":
            if self.second_table is not None or self.mapping is not None:
                raise ValueError("single operation required for group experiment")
        else:
            if self.second_table is None:
                raise ValueError("second operation table required")
            m = validate(self.second_table)
            if self.mode == "ring":
                if n != m or self.mapping is not None:
                    raise ValueError("ring operations share the same labelled domain")
            elif (
                self.mapping is None
                or len(self.mapping) != n
                or any(not 0 <= a < m for a in self.mapping)
            ):
                raise ValueError("total mapping into target domain required")
        return self


def check_algebra_work(work: AlgebraWork) -> dict:
    if work.mode == "group":
        report = group(work.table)
    elif work.mode == "ring":
        report = ring(work.table, work.second_table)
    else:
        report = homomorphism(work.table, work.second_table, work.mapping)
    criteria = []
    for key, prediction in work.predictions.items():
        actual = report[key]
        criteria.append(
            {
                "id": key,
                "status": "needs_review"
                if actual is None
                else "met"
                if prediction is actual
                else "not_met",
                "reason": "前置封闭条件未成立，此项没有执行检查。"
                if actual is None
                else "已对完整有限表穷举检查，并与预测比较。",
            }
        )
    correct = all(row["status"] == "met" for row in criteria)
    criteria.extend(
        [
            {
                "id": "explanation",
                "status": "needs_review" if work.explanation.strip() else "not_met",
                "reason": "反例和推理解释需要独立审阅。",
            },
            {
                "id": "independent_transfer",
                "status": "needs_review",
                "reason": "本次完整有限表检查不证明一般结构、独立迁移或长期掌握。",
            },
        ]
    )
    return {
        "client_artifact_id": str(work.client_artifact_id),
        "client_revision_id": str(work.client_revision_id),
        "artifact_hash": canonical_hash(work.model_dump(mode="json")),
        "checker_version": "finite-algebra-exhaustive-v1",
        "provenance": "server_deterministic_checker",
        "report": report,
        "prediction_correct": correct,
        "criteria": criteria,
        "mastery_asserted": False,
    }
