"""Deterministic bracket-matching judgement checker for CS03 unit U04.

The real Python/C++ ``brackets_match`` implementation must run in an isolated
execution adapter (E01) that is unavailable on this host, so source-code runs
stay ``isolated_runner_pending``. What *can* be checked deterministically now is
the learner's judgement over a fixed, public set of bracket strings: whether
each string is balanced and, when it is not, the 0-based index of the first
offending bracket -- a closing bracket that underflows/mismatches, or the first
opening bracket left unclosed. This gives STACK-02 runnable, per-condition
evidence without shipping an answer key in the public package.

Conventions follow UNIT_EXAMPLE_CS03_STACK.md (U04): the alphabet is restricted
to ``()[]{}``, the empty string is balanced, and indices start at 0.
"""

from __future__ import annotations

import platform
from dataclasses import dataclass
from typing import Any, Literal

from vault_backend.checker import canonical_hash

OPEN_TO_CLOSE = {"(": ")", "[": "]", "{": "}"}
CLOSE_TO_OPEN = {")": "(", "]": "[", "}": "{"}
ALLOWED = set("()[]{}")

DiagnosisKind = Literal["closing_mismatch", "unclosed_opening"]


@dataclass(frozen=True)
class BracketDiagnosis:
    matched: bool
    index: int | None  # 0-based index of the first offending bracket
    kind: DiagnosisKind | None


def diagnose_brackets(text: str) -> BracketDiagnosis:
    """Return the balance verdict and the first offending bracket index."""

    stack: list[tuple[str, int]] = []  # (opening bracket, its index)
    for index, char in enumerate(text):
        if char not in ALLOWED:
            raise ValueError("bracket activity only accepts the characters ()[]{}")
        if char in OPEN_TO_CLOSE:
            stack.append((char, index))
            continue
        if not stack or stack[-1][0] != CLOSE_TO_OPEN[char]:
            # Closing bracket with an empty stack or a mismatching top.
            return BracketDiagnosis(False, index, "closing_mismatch")
        stack.pop()
    if stack:
        return BracketDiagnosis(False, stack[0][1], "unclosed_opening")
    return BracketDiagnosis(True, None, None)


def brackets_match(text: str) -> bool:
    return diagnose_brackets(text).matched


# --- Trusted U04 activity identity and the fixed public judgement set --------
#
# The prompt strings below are public learning material (shipped in the course
# package); their correct verdicts/index are computed server-side only.

BRACKET_ACTIVITY_VERSION = "CS03-STACK-U04-JUDGE@0.1.0"
BRACKET_STANDARD_VERSION = "bracket-judgement-v1"
BRACKET_CHECKER_VERSION = "bracket-checker@0.1.0"
BRACKET_CASES: tuple[str, ...] = ("", "([{}])", "()[]{}", "([)]", ")(", "(()")

_COURSE_ID = "e7b6a2d4-dee6-4ee6-98b5-13afc2c880ca"
_COURSE_VERSION_ID = "c47c1551-76d5-4b80-aeae-33cd253d8ca0"
_COURSE_VERSION = "CS03-example-0.2.0"
_ACTIVITY_ID = "7c1e5a04-0001-4a00-8000-000000000004"
_ACTIVITY_VERSION_ID = "7c1e5a04-0002-4a00-8000-000000000004"
_OBJECTIVE_IDS = ("e9a64c86-00b2-45e5-8597-3d7717d88643",)  # CS03-STACK-02

BRACKET_CONTEXT: dict[str, Any] = {
    "course_id": _COURSE_ID,
    "course_version_id": _COURSE_VERSION_ID,
    "activity_id": _ACTIVITY_ID,
    "activity_version_id": _ACTIVITY_VERSION_ID,
    "objective_ids": list(_OBJECTIVE_IDS),
}


def expected_judgements() -> list[dict[str, Any]]:
    """Server-side answer key for the fixed judgement set (never shipped)."""

    return [
        {
            "case": text,
            "matched": diagnosis.matched,
            "mismatch_index": diagnosis.index,
            "kind": diagnosis.kind,
        }
        for text in BRACKET_CASES
        for diagnosis in (diagnose_brackets(text),)
    ]


def verify_bracket_judgements(submission: dict[str, Any]) -> dict[str, Any]:
    """Verify one bracket-judgement submission against the fixed case set.

    submission keys: client_artifact_id, client_revision_id, explanation,
    judgements[], where each judgement is {"case": str, "matched": bool,
    "mismatch_index": int | None}.
    """

    judgements: list[dict[str, Any]] = submission["judgements"]
    if [item.get("case") for item in judgements] != list(BRACKET_CASES):
        raise ValueError(
            "提交的判定用例集合或顺序与活动固定用例不一致，请使用课程包下发的六组用例。"
        )

    rows: list[dict[str, Any]] = []
    nesting_ok = True
    diagnose_ok = True
    for index, (student, want) in enumerate(
        zip(judgements, expected_judgements(), strict=True), start=1
    ):
        issues: list[str] = []
        student_matched = bool(student.get("matched"))
        student_index = student.get("mismatch_index")
        if student_matched != want["matched"]:
            nesting_ok = False
            diagnose_ok = False
            issues.append(
                f"第 {index} 组对“是否匹配”的判断错误，"
                f"应为 {'匹配' if want['matched'] else '不匹配'}。"
            )
        if student_index != want["mismatch_index"]:
            diagnose_ok = False
            wanted = (
                "空（匹配）" if want["mismatch_index"] is None else f"索引 {want['mismatch_index']}"
            )
            issues.append(f"第 {index} 组首个问题括号位置错误，应为 {wanted}。")
        rows.append(
            {
                "index": index,
                "case": want["case"],
                "correct": not issues,
                "issues": issues,
            }
        )

    bracket_correct = all(row["correct"] for row in rows)
    explanation_present = bool(str(submission.get("explanation", "")).strip())
    criteria: list[dict[str, str]] = [
        {
            "id": "brackets.nesting",
            "title": "用栈的后进先出正确判断每组括号是否匹配（含空串）",
            "status": "met" if nesting_ok else "not_met",
            "reason": "六组固定用例的匹配判定已由确定性检查器逐组核对。",
        },
        {
            "id": "brackets.diagnose",
            "title": "定位首个失配闭括号或未闭合左括号的索引",
            "status": "met" if diagnose_ok else "not_met",
            "reason": "失配与未闭合的首个位置已逐组与参考诊断核对。",
        },
        {
            "id": "explanation",
            "title": "说明闭括号为何应匹配最近的左括号及边界处理",
            "status": "needs_review" if explanation_present else "not_met",
            "reason": "文字解释尚未经过独立审阅。" if explanation_present else "尚未提供解释。",
        },
        {
            "id": "independent_transfer",
            "title": "在独立新串中迁移判定方法",
            "status": "needs_review",
            "reason": "固定用例判定正确不能证明能独立处理新串，真实代码运行仍待隔离环境。",
        },
    ]

    return {
        "verification_id": None,
        "course_code": "CS03",
        "course_version": _COURSE_VERSION,
        "activity_version": BRACKET_ACTIVITY_VERSION,
        "standard_version": BRACKET_STANDARD_VERSION,
        "client_artifact_id": str(submission["client_artifact_id"]),
        "client_revision_id": str(submission["client_revision_id"]),
        "artifact_hash": canonical_hash(
            {
                "kind": "bracket_judgement_with_explanation",
                "judgements": judgements,
                "explanation": submission.get("explanation", ""),
            }
        ),
        "checker_version": BRACKET_CHECKER_VERSION,
        "runtime": f"CPython {platform.python_version()}",
        "provenance": "server_deterministic_checker",
        "bracket_correct": bracket_correct,
        "rows": rows,
        "criteria": criteria,
        "objective_state": "evidence_pending_review" if bracket_correct else "practicing",
        "mastery_asserted": False,
        "summary": "六组括号判定与定位逐组核对通过；文字解释、真实代码运行与独立新串仍待复核。"
        if bracket_correct
        else "已标出让判断或定位不一致的用例，对照栈规则修改后可再次核验。",
    }
