"""Bounded native-table work validation; no execution of user supplied code.

This checker is internal until an immutable published activity registers it.
It grades predictions about the submitted tables, not whether every table is a
positive example. Context and server verification IDs belong to that registry.
"""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

from vault_backend.course_checks.finite_algebra import group, homomorphism, ring, validate

Element = Annotated[StrictInt, Field(ge=-1_000_000, le=1_000_000)]
TableRow = Annotated[list[Element], Field(min_length=1, max_length=12)]
OperationTable = Annotated[list[TableRow], Field(min_length=1, max_length=12)]
KEYS = {
    "group": ("closed", "associative", "is_group"),
    "ring": ("ring", "unital_ring", "field"),
    "homomorphism": ("preserves_operation", "injective", "surjective", "is_group_isomorphism"),
}


class AlgebraWork(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["group", "ring", "homomorphism"]
    table: OperationTable
    second_table: OperationTable | None = None
    mapping: list[Element] | None = Field(default=None, min_length=1, max_length=12)
    # null is an explicit prediction that a prerequisite prevents checking,
    # never an omitted prediction or a wildcard matching computed booleans.
    predictions: dict[str, StrictBool | None] = Field(min_length=3, max_length=4)
    explanation: str = Field(default="", max_length=4000)
    client_artifact_id: UUID
    client_revision_id: UUID

    @model_validator(mode="after")
    def complete_work(self):
        n = validate(self.table)
        if set(self.predictions) != set(KEYS[self.mode]):
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
    from vault_backend.checker import canonical_hash

    if work.mode == "group":
        report = group(work.table)
    elif work.mode == "ring":
        report = ring(work.table, work.second_table)
    else:
        report = homomorphism(work.table, work.second_table, work.mapping)
    criteria = []
    for key in KEYS[work.mode]:
        prediction = work.predictions[key]
        actual = report[key]
        criteria.append(
            {
                "id": key,
                "status": "met"
                if prediction is actual
                else "needs_review"
                if actual is None
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


class AlgebraSubmission(AlgebraWork):
    kind: Literal["verify_finite_algebra"]
    course_version_id: UUID
    activity_version_id: UUID
    objective_code: str = Field(min_length=1, max_length=80)


class AlgebraRegistry:
    """Only application-loaded, validated public packages register activities."""

    def __init__(self, packages):
        from vault_backend.course_packages import PublicCoursePackage

        self.activities = {}
        for raw in packages:
            package = PublicCoursePackage.model_validate(raw)
            for activity in package.activities:
                if activity.kind != "finite_algebra" or activity.availability != "practice_ready":
                    continue
                if activity.check_version != "finite-algebra-exhaustive-v1":
                    continue
                key = (package.course_version_id, activity.version_id)
                if key in self.activities:
                    raise ValueError("Duplicate registered algebra version")
                self.activities[key] = (package, activity)

    def resolve(self, submission: AlgebraSubmission):
        from vault_backend.errors import ApiError

        entry = self.activities.get(
            (str(submission.course_version_id), str(submission.activity_version_id))
        )
        if entry is None:
            raise ApiError(422, "ALGEBRA_ACTIVITY_UNKNOWN", "此课程版本的有限运算表活动未注册。")
        package, activity = entry
        prompt = activity.algebra_prompt
        if (
            submission.objective_code not in activity.objective_codes
            or submission.mode != prompt.mode
            or len(submission.table) != len(prompt.table)
            or (submission.second_table is None) != (prompt.second_table is None)
            or (
                submission.second_table is not None
                and len(submission.second_table) != len(prompt.second_table)
            )
        ):
            raise ApiError(
                422, "ALGEBRA_CONTEXT_MISMATCH", "学习目标、实验类型或集合大小与活动不一致。"
            )
        return package, activity

    def verify(self, submission: AlgebraSubmission):
        package, activity = self.resolve(submission)
        result = check_algebra_work(submission)
        result.update(
            {
                "course_id": package.course_id,
                "course_version_id": package.course_version_id,
                "course_code": package.course_code,
                "course_version": package.version,
                "activity_id": activity.id,
                "activity_version_id": activity.version_id,
                "activity_version": activity.version,
                "objective_ids": [
                    o.id for o in package.objectives if o.code in activity.objective_codes
                ],
                "standard_version": "finite-algebra-exhaustive-v1",
            }
        )
        return result
