"""Generic structured-trace verifier (E02) driven by trusted activity specs.

The verifier replays each activity through a deterministic teaching machine and
compares the student's predicted snapshot field by field. It emits per-condition
``met`` / ``not_met`` / ``needs_review`` results and never asserts full mastery:
a fixed worked trace cannot prove independent transfer, and written explanations
stay ``needs_review`` until independently reviewed (CONFIRMED_DECISIONS.md).

Activity specifications are registered server-side (see ``TRUSTED_TRACE_SPECS``);
a request can only select a registered activity, never upload its own checker or
expected answers.
"""

import platform
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

from vault_backend.checker import canonical_hash
from vault_backend.course_checks.machines import (
    Operation,
    RingQueueMachine,
    StackMachine,
)

MachineKind = Literal["stack", "ring_queue"]

FIELD_LABELS = {
    "items": "栈内容（底→顶，右端为栈顶）",
    "buffer": "循环队列物理数组（空位为 null）",
    "head": "head 指针（下次出队位置）",
    "tail": "tail 指针（下次入队位置）",
    "size": "元素个数 size",
}
STATUS_LABEL = "边界状态（空操作为 underflow、满操作为 full）"
VALUE_LABELS = {
    "stack": "操作输出（弹出值；入栈或失败时为空）",
    "ring_queue": "操作输出（出队值；入队或失败时为空）",
}


@dataclass(frozen=True)
class CriterionRule:
    """Maps one objective condition to the steps/fields that evidence it."""

    id: str
    title: str
    steps: tuple[int, ...]  # 1-based step indices
    fields: tuple[str, ...]  # state fields compared for those steps
    check_value: bool = False
    check_status: bool = False


@dataclass(frozen=True)
class TraceSpec:
    activity_version: str
    standard_version: str
    checker_version: str
    machine: MachineKind
    state_fields: tuple[str, ...]
    operations: tuple[Operation, ...]
    criteria: tuple[CriterionRule, ...]
    capacity: Optional[int] = None
    # Trusted identity used to attach evidence to the right course/objectives.
    course_code: str = "CS03"
    course_id: str = ""
    course_version_id: str = ""
    course_version: str = ""
    activity_id: str = ""
    activity_version_id: str = ""
    objective_ids: tuple[str, ...] = ()

    @property
    def context(self) -> dict[str, Any]:
        return {
            "course_id": self.course_id,
            "course_version_id": self.course_version_id,
            "activity_id": self.activity_id,
            "activity_version_id": self.activity_version_id,
            "objective_ids": list(self.objective_ids),
        }

    def expected(self) -> list[dict[str, Any]]:
        if self.machine == "stack":
            snapshots = StackMachine(self.capacity).run(self.operations)
        else:
            if self.capacity is None:
                raise ValueError("ring queue requires a capacity")
            snapshots = RingQueueMachine(self.capacity).run(self.operations)
        return [snapshot.__dict__ for snapshot in snapshots]

    def expected_submission_steps(self) -> list[dict[str, Any]]:
        """Canonical correct steps in the student submission envelope.

        Server-side only (tests, teacher tooling). The answer envelope must
        never be shipped to the public client; the client receives operations.
        """
        return [
            {
                "state": {name: row[name] for name in self.state_fields},
                "value": row["value"],
                "status": row["status"],
            }
            for row in self.expected()
        ]


def _normalized(value: Any) -> Any:
    """Compare JSON-origin student values with tuple-based expected snapshots."""

    if isinstance(value, (list, tuple)):
        return tuple(_normalized(item) for item in value)
    return value


def _row_issues(
    index: int,
    student: dict[str, Any],
    expected: dict[str, Any],
    spec: TraceSpec,
) -> list[str]:
    issues: list[str] = []
    state = student.get("state") or {}
    for field_name in spec.state_fields:
        if _normalized(state.get(field_name)) != _normalized(expected[field_name]):
            issues.append(f"第 {index} 步{FIELD_LABELS[field_name]}不一致。")
    if _normalized(student.get("value")) != _normalized(expected["value"]):
        issues.append(f"第 {index} 步{VALUE_LABELS[spec.machine]}不一致。")
    if student.get("status") != expected["status"]:
        issues.append(f"第 {index} 步{STATUS_LABEL}不一致，失败操作不得改变状态。")
    return issues


def _criterion_status(
    rule: CriterionRule, rows: list[dict[str, Any]], expected: list[dict[str, Any]], spec: TraceSpec
) -> str:
    for step in rule.steps:
        index = step - 1
        row = rows[index]
        want = expected[index]
        state = row["_state"]
        for field_name in rule.fields:
            if _normalized(state.get(field_name)) != _normalized(want[field_name]):
                return "not_met"
        if rule.check_value and _normalized(row["_value"]) != _normalized(want["value"]):
            return "not_met"
        if rule.check_status and row["_status"] != want["status"]:
            return "not_met"
    return "met"


def verify_structured_trace(submission: dict[str, Any], spec: TraceSpec) -> dict[str, Any]:
    """Verify one structured-trace submission against a trusted spec.

    submission keys: course_version, client_artifact_id, client_revision_id,
    explanation, steps[]. Each step is {"state": {...}, "value": int|None,
    "status": "ok"|"underflow"|"full"}.
    """

    student_steps: list[dict[str, Any]] = submission["steps"]
    if len(student_steps) != len(spec.operations):
        raise ValueError("提交的步数与活动操作序列不一致。")

    expected = spec.expected()
    rows: list[dict[str, Any]] = []
    for index, (student, want) in enumerate(zip(student_steps, expected), start=1):
        issues = _row_issues(index, student, want, spec)
        rows.append(
            {
                "index": index,
                "correct": not issues,
                "issues": issues,
                "_state": student.get("state") or {},
                "_value": student.get("value"),
                "_status": student.get("status"),
            }
        )

    trace_correct = all(row["correct"] for row in rows)
    explanation_present = bool(str(submission.get("explanation", "")).strip())

    criteria: list[dict[str, str]] = [
        {
            "id": rule.id,
            "title": rule.title,
            "status": _criterion_status(rule, rows, expected, spec),
            "reason": "相关步骤已由确定性状态机逐字段核对。",
        }
        for rule in spec.criteria
    ]
    criteria.append(
        {
            "id": "explanation",
            "title": "用文字解释边界与次序的理由",
            "status": "needs_review" if explanation_present else "not_met",
            "reason": "文字解释尚未经过独立审阅。"
            if explanation_present
            else "尚未提供解释。",
        }
    )
    criteria.append(
        {
            "id": "independent_transfer",
            "title": "在独立新情境中迁移",
            "status": "needs_review",
            "reason": "固定操作序列正确不能证明能独立处理新情境，需完成独立变体。",
        }
    )

    public_rows = [{k: v for k, v in row.items() if not k.startswith("_")} for row in rows]
    return {
        "verification_id": None,
        "course_code": spec.course_code,
        "course_version": spec.course_version,
        "activity_version": spec.activity_version,
        "standard_version": spec.standard_version,
        "client_artifact_id": str(submission["client_artifact_id"]),
        "client_revision_id": str(submission["client_revision_id"]),
        "artifact_hash": canonical_hash(
            {
                "kind": f"{spec.machine}_structured_trace_with_explanation",
                "steps": student_steps,
                "explanation": submission.get("explanation", ""),
            }
        ),
        "checker_version": spec.checker_version,
        "runtime": f"CPython {platform.python_version()}",
        "provenance": "server_deterministic_checker",
        "trace_correct": trace_correct,
        "rows": public_rows,
        "criteria": criteria,
        "objective_state": "evidence_pending_review" if trace_correct else "practicing",
        "mastery_asserted": False,
        "summary": "状态轨迹逐行核对通过；文字解释与独立新情境仍待复核。"
        if trace_correct
        else "已标出不一致的步骤，对照必要原理修改后可再次核验。",
    }


# --- Trusted activity specifications (CS03 stack/queue unit, U01 & U02) ------


def _stack_unit_u01() -> TraceSpec:
    operations = (
        Operation("pop"),
        Operation("push", 4),
        Operation("push", 7),
        Operation("pop"),
        Operation("push", 9),
        Operation("push", 2),
        Operation("push", 5),  # capacity 3 -> full, state unchanged
    )
    return TraceSpec(
        activity_version="CS03-STACK-U01-TRACE@0.1.0",
        standard_version="stack-bounds-trace-v1",
        checker_version="stack-trace-checker@0.2.0",
        machine="stack",
        capacity=3,
        state_fields=("items",),
        operations=operations,
        criteria=(
            CriterionRule(
                id="stack.order",
                title="按后进先出推演每一步栈内容与弹出值",
                steps=(2, 3, 4, 5, 6),
                fields=("items",),
                check_value=True,
            ),
            CriterionRule(
                id="stack.bounds",
                title="正确处理空栈出栈与满栈入栈，失败不改变状态",
                steps=(1, 7),
                fields=("items",),
                check_value=True,
                check_status=True,
            ),
        ),
        course_id="e7b6a2d4-dee6-4ee6-98b5-13afc2c880ca",
        course_version_id="c47c1551-76d6-4b80-aeae-33cd253d8ca0",
        course_version="CS03-example-0.2.0",
        activity_id="7c1e5a01-0001-4a00-8000-000000000001",
        activity_version_id="7c1e5a01-0002-4a00-8000-000000000001",
        objective_ids=("e790d0f5-ea0a-4924-a482-06b9ff8ab944",),
    )


def _queue_unit_u02() -> TraceSpec:
    operations = (
        Operation("dequeue"),          # 1 empty -> underflow
        Operation("enqueue", 1),       # 2 A
        Operation("enqueue", 2),       # 3 B
        Operation("enqueue", 3),       # 4 C -> full (size 3)
        Operation("enqueue", 4),       # 5 D rejected -> full, unchanged
        Operation("dequeue"),          # 6 -> A
        Operation("enqueue", 4),       # 7 D wraps into freed slot
        Operation("dequeue"),          # 8 -> B
        Operation("dequeue"),          # 9 -> C
        Operation("dequeue"),          # 10 -> D
        Operation("dequeue"),          # 11 empty -> underflow
    )
    return TraceSpec(
        activity_version="CS03-QUEUE-U02-TRACE@0.1.0",
        standard_version="ring-queue-trace-v1",
        checker_version="ring-queue-checker@0.1.0",
        machine="ring_queue",
        capacity=3,
        state_fields=("buffer", "head", "tail", "size"),
        operations=operations,
        criteria=(
            CriterionRule(
                id="queue.fifo",
                title="按先进先出得到正确的出队次序与规模变化",
                steps=(6, 8, 9, 10),
                fields=("size",),
                check_value=True,
                check_status=True,
            ),
            CriterionRule(
                id="queue.wrap",
                title="处理取模绕回后的物理布局与队满不覆盖",
                steps=(4, 5, 6, 7),
                fields=("buffer", "head", "tail", "size"),
                check_status=True,
            ),
            CriterionRule(
                id="queue.bounds",
                title="正确判定空队/满队，失败操作不改变状态",
                steps=(1, 5, 11),
                fields=("buffer", "head", "tail", "size"),
                check_value=True,
                check_status=True,
            ),
        ),
        course_id="e7b6a2d4-dee6-4ee6-98b5-13afc2c880ca",
        course_version_id="c47c1551-76d6-4b80-aeae-33cd253d8ca0",
        course_version="CS03-example-0.2.0",
        activity_id="7c1e5a02-0001-4a00-8000-000000000002",
        activity_version_id="7c1e5a02-0002-4a00-8000-000000000002",
        objective_ids=("c9049f14-1182-406e-a632-d6eeb2c9053c",),
    )


TRUSTED_TRACE_SPECS: dict[str, TraceSpec] = {
    spec.activity_version: spec
    for spec in (_stack_unit_u01(), _queue_unit_u02())
}

for _spec in TRUSTED_TRACE_SPECS.values():
    if not (
        _spec.course_id
        and _spec.course_version_id
        and _spec.course_version
        and _spec.activity_id
        and _spec.activity_version_id
        and _spec.objective_ids
    ):
        raise RuntimeError(f"incomplete trusted trace spec identity: {_spec.activity_version}")


def get_trace_spec(activity_version: str) -> TraceSpec:
    try:
        return TRUSTED_TRACE_SPECS[activity_version]
    except KeyError:
        raise KeyError(f"no trusted structured-trace spec for {activity_version}") from None
