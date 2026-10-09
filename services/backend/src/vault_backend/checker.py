import hashlib
import json
import platform
from typing import Any

from vault_backend.schemas import TraceSubmission, TruthTableSubmission

OPERATIONS: tuple[tuple[str, int | None], ...] = (
    ("push", 8),
    ("push", 3),
    ("pop", None),
    ("push", 5),
    ("pop", None),
    ("pop", None),
    ("pop", None),
)
CHECKER_VERSION = "stack-trace-checker@0.1.0"
STACK_COURSE_VERSION = "CS03-example-0.2.0"
LOGIC_CHECKER_VERSION = "propositional-table-checker@0.1.0"
LOGIC_ASSIGNMENTS = ((False, False), (False, True), (True, False), (True, True))


def canonical_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_trace(submission: TraceSubmission) -> dict[str, Any]:
    """Execute fixed stack operations. No eval/exec, client expectations or LLM grading."""
    if submission.trace is None:
        raise ValueError("A complete trace is required")
    stack: list[int] = []
    rows: list[dict[str, Any]] = []
    for index, ((action, value), student) in enumerate(
        zip(OPERATIONS, submission.trace, strict=True)
    ):
        output = None
        underflow = False
        if action == "push":
            assert value is not None
            stack.append(value)
        elif stack:
            output = stack.pop()
        else:
            underflow = True
        issues = []
        if student.after_stack != stack:
            issues.append("操作后的栈内容或顺序不一致。栈顶约定为数组右端。")
        if student.output != output:
            issues.append("当前操作输出不一致；入栈与空栈出栈均没有元素输出。")
        if student.underflow != underflow:
            issues.append("空栈出栈标记不一致；本活动约定保持空栈并标记 underflow。")
        rows.append({"index": index + 1, "correct": not issues, "issues": issues})
    correct = all(row["correct"] for row in rows)
    boundary_correct = rows[-1]["correct"]
    explanation_present = bool(submission.explanation.strip())
    return {
        "verification_id": None,  # Assigned only when stored in the short-lived lease.
        "course_code": submission.course_code,
        "course_version": STACK_COURSE_VERSION,
        "activity_version": submission.activity_version,
        "standard_version": submission.standard_version,
        "client_artifact_id": str(submission.client_artifact_id),
        "client_revision_id": str(submission.client_revision_id),
        "artifact_hash": canonical_hash(
            {
                "kind": "stack_trace_with_explanation",
                "trace": [step.model_dump(mode="json") for step in submission.trace],
                "explanation": submission.explanation,
            }
        ),
        "checker_version": CHECKER_VERSION,
        "runtime": f"CPython {platform.python_version()}",
        "provenance": "server_deterministic_checker",
        "trace_correct": correct,
        "rows": rows,
        "criteria": [
            {
                "id": "state_trace",
                "status": "met" if correct else "not_met",
                "reason": "固定操作序列已真实执行并逐行比对。",
            },
            {
                "id": "boundary_condition",
                "status": "met" if boundary_correct else "not_met",
                "reason": "已比对最后一次空栈出栈；其他边界仍需新的活动。",
            },
            {
                "id": "explanation",
                "status": "needs_review" if explanation_present else "not_met",
                "reason": "文字解释尚未经过独立审核。" if explanation_present else "尚未提供解释。",
            },
            {
                "id": "independent_transfer",
                "status": "needs_review",
                "reason": "固定样例正确不能证明能独立处理新情境。",
            },
        ],
        "objective_state": "evidence_pending_review" if correct else "practicing",
        "mastery_asserted": False,
        "summary": "状态追踪通过；解释和迁移应用仍待核验。"
        if correct
        else "已定位不一致的步骤，修改作品后可以再次核验。",
    }


def verify_truth_table(submission: TruthTableSubmission) -> dict[str, Any]:
    """Compare each student cell with truth-functional semantics; never evaluate input code."""
    rows: list[dict[str, Any]] = []
    for index, ((p, q), prediction) in enumerate(
        zip(LOGIC_ASSIGNMENTS, submission.rows, strict=True)
    ):
        expected = {
            "implication": (not p) or q,
            "contrapositive": q or (not p),
            "biconditional": p == q,
        }
        observed = prediction.model_dump()
        issues = [name for name, value in expected.items() if observed[name] is not value]
        rows.append(
            {
                "index": index + 1,
                "p": p,
                "q": q,
                "correct": not issues,
                "issues": issues,
                "expected": expected,
            }
        )
    columns = ("implication", "contrapositive", "biconditional")
    statuses = {name: all(name not in row["issues"] for row in rows) for name in columns}
    explanation_present = bool(submission.explanation.strip())
    return {
        "verification_id": None,
        "course_code": submission.course_code,
        "course_version": "CS05-example-0.1.0",
        "activity_version": submission.activity_version,
        "standard_version": submission.standard_version,
        "client_artifact_id": str(submission.client_artifact_id),
        "client_revision_id": str(submission.client_revision_id),
        "artifact_hash": canonical_hash(
            {
                "kind": "truth_table_with_explanation",
                "rows": [row.model_dump(mode="json") for row in submission.rows],
                "explanation": submission.explanation,
            }
        ),
        "checker_version": LOGIC_CHECKER_VERSION,
        "runtime": f"CPython {platform.python_version()}",
        "provenance": "server_deterministic_checker",
        "truth_correct": all(statuses.values()),
        "rows": rows,
        "criteria": [
            {
                "id": name,
                "status": "met" if statuses[name] else "not_met",
                "reason": "已逐格核对固定赋值下的真值。",
            }
            for name in columns
        ]
        + [
            {
                "id": "explanation",
                "status": "needs_review" if explanation_present else "not_met",
                "reason": (
                    "文字推理尚未独立审阅。"
                    if explanation_present
                    else "尚未解释反例和等价关系。"
                ),
            },
            {
                "id": "independent_transfer",
                "status": "needs_review",
                "reason": "同一固定真值表不能证明独立迁移或长期掌握。",
            },
        ],
        "objective_state": "evidence_pending_review" if all(statuses.values()) else "practicing",
        "mastery_asserted": False,
        "summary": "真值格已核对；推理解释和新情境应用仍待审阅。"
        if all(statuses.values())
        else "已标出不一致的真值格，修改作品后可再次核验。",
    }
