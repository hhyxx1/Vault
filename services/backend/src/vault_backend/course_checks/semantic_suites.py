"""Trusted semantic code verification (C02).

Replaces a single hard-coded stdout comparison with:

* multiple inputs executed in the isolated worker (visible learning cases plus
  server-held independent cases that are never published in the manifest);
* a small, platform-controlled whitelist of pure oracles and comparators so
  alternative correct solutions (different spacing/order/format) are accepted
  without trusting any client- or teacher-uploaded grading program;
* explicit separation of compile errors, runtime errors, timeouts and
  infrastructure failure (the last never lowers a student's ability state);
* an anti-hardcoding signal: visible cases passing while independent cases fail
  is reported as suspected sample hard-coding, not as success.

The finite set of cases can never prove general correctness; ``mastery_asserted``
stays false and explanation / independent transfer remain ``needs_review``.

No ``eval``/``exec`` and no uploaded code: oracles are audited pure functions
registered in this module only.
"""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
from vault_backend.errors import ApiError

STANDARD = "code-semantic-suite-v1"
PROVENANCE = "server_deterministic_checker"

Comparator = Literal[
    "exact", "integer", "number_tol", "token_multiset", "line_set", "sorted_lines"
]
CaseKind = Literal["visible", "independent"]

# Student-program outcomes that are the learner's responsibility, not infra.
_STUDENT_FAILURE = {"compile_error", "runtime_error", "timeout", "resource_limit"}
# Outcomes that must never be turned into a judgement about ability.
_INFRA_FAILURE = {"environment_error"}


@dataclass(frozen=True)
class SuiteCase:
    """One executed input. Independent cases stay server-side until run."""

    code: str
    kind: CaseKind
    stdin: str


@dataclass(frozen=True)
class SemanticSuite:
    course_version_id: str
    objective_code: str
    activity_version_id: str
    language: str
    oracle_id: str
    visible_cases: tuple[SuiteCase, ...]
    independent_cases: tuple[SuiteCase, ...]
    comparator: Comparator = "integer"
    tolerance: float = 0.0
    standard_version: str = STANDARD
    scope_note: str = (
        "仅核验有限组受控输入上的结果与状态；通过不证明一般正确性，"
        "解释与独立迁移仍需独立复核。"
    )


# --- Audited, pure oracles (stdin text -> expected stdout text). -------------
# These are the only accepted "graders": platform code, never user uploads.


def _parking_fee_three_tier(stdin: str) -> str:
    """CS01-M03 three-tier fee, inclusive endpoints: <=30 -> 0, <=60 -> 5, else 10."""
    minutes = int(stdin.strip())
    fee = 0 if minutes <= 30 else 5 if minutes <= 60 else 10
    return f"{fee}\n"


ORACLES: dict[str, Callable[[str], str]] = {
    "parking_fee_three_tier": _parking_fee_three_tier,
}


# --- Comparators (accept alternative-correct presentations). -----------------


def compare_output(mode: Comparator, expected: str, observed: str, tolerance: float = 0.0) -> bool:
    if mode == "exact":
        return expected == observed
    if mode == "integer":
        try:
            return int(expected.strip()) == int(observed.strip())
        except (ValueError, TypeError):
            return False
    if mode == "number_tol":
        try:
            exp, obs = float(expected.strip()), float(observed.strip())
        except (ValueError, TypeError):
            return False
        return math.isclose(exp, obs, rel_tol=1e-9, abs_tol=max(tolerance, 0.0))
    if mode == "token_multiset":
        return Counter(expected.split()) == Counter(observed.split())
    lines_exp = [line for line in expected.splitlines() if line.strip()]
    lines_obs = [line for line in observed.splitlines() if line.strip()]
    if mode == "line_set":
        return set(lines_exp) == set(lines_obs)
    if mode == "sorted_lines":
        return sorted(lines_exp) == sorted(lines_obs)
    raise ValueError(f"unknown comparator: {mode}")


# --- Trusted registry. -------------------------------------------------------

_CS01_090 = "7ca20169-02d2-5719-b3f0-eff208ae89db"

SUITES: dict[tuple[str, str], SemanticSuite] = {
    # CS01-M03-O03: read minutes from stdin and apply the inclusive three-tier
    # rule. Visible cases are the endpoints taught in the activity; independent
    # cases are held server-side and expose programs that hard-code 30/60.
    (_CS01_090, "CS01-M03-O03"): SemanticSuite(
        course_version_id=_CS01_090,
        objective_code="CS01-M03-O03",
        activity_version_id="256601b5-be28-5e49-8a78-d8f39b8f48b4",
        language="c17",
        oracle_id="parking_fee_three_tier",
        comparator="integer",
        visible_cases=(
            SuiteCase("visible-30", "visible", "30\n"),
            SuiteCase("visible-60", "visible", "60\n"),
        ),
        independent_cases=(
            SuiteCase("indep-0", "independent", "0\n"),
            SuiteCase("indep-29", "independent", "29\n"),
            SuiteCase("indep-31", "independent", "31\n"),
            SuiteCase("indep-59", "independent", "59\n"),
            SuiteCase("indep-61", "independent", "61\n"),
            SuiteCase("indep-120", "independent", "120\n"),
        ),
        scope_note=(
            "按 CS01-M03 三段计费（含端点）在多组分钟数上核验；独立输入不公开，"
            "仅针对 30/60 硬编码常量的程序会在独立输入上失败。"
        ),
    ),
}


def get_suite(
    course_version_id: str,
    objective_code: str,
    activity_version_id: str | None = None,
) -> SemanticSuite:
    suite = SUITES.get((course_version_id, objective_code))
    if suite is None:
        raise ApiError(404, "SEMANTIC_SUITE_UNAVAILABLE", "该目标没有登记受信语义核验套件。")
    if activity_version_id is not None and activity_version_id != suite.activity_version_id:
        raise ApiError(404, "SEMANTIC_SUITE_UNAVAILABLE", "该活动版本没有登记语义核验套件。")
    return suite


def visible_case_stdins(suite: SemanticSuite) -> list[str]:
    """Only visible learning inputs may be shown before submission."""
    return [case.stdin for case in suite.visible_cases]


# --- Per-case and aggregate assessment. --------------------------------------


def _assess_case(suite: SemanticSuite, case: SuiteCase, result: CodeResult) -> dict:
    expected = ORACLES[suite.oracle_id](case.stdin)
    base = {
        "case_code": case.code,
        "kind": case.kind,
        "stdin": case.stdin,
        "expected_stdout": expected,
        "observed_status": result.status,
        "observed_stdout": result.stdout,
    }
    if result.status in _INFRA_FAILURE or result.phase == "cleanup" or result.truncated:
        return {
            **base,
            "status": "needs_review",
            "reason": "基础设施故障、清理受阻或输出不完整，未对该输入作能力判断。",
        }
    if result.status in _STUDENT_FAILURE:
        labels = {
            "compile_error": "编译未通过",
            "runtime_error": "运行时错误或非正常退出",
            "timeout": "执行超时",
            "resource_limit": "超出资源限制",
        }
        return {
            **base,
            "status": "not_met",
            "reason": f"{labels[result.status]}；该输入未得到预期结果。",
        }
    matched = compare_output(suite.comparator, expected, result.stdout, suite.tolerance)
    return {
        **base,
        "status": "met" if matched else "not_met",
        "reason": (
            "该输入的状态与结果满足语义条件（接受等价的正确呈现）。"
            if matched
            else f"语义不一致：期望 {expected.strip()!r}，实际 {result.stdout.strip()!r}。"
        ),
    }


async def run_suite(
    run: Callable[[CodeRequest], Awaitable[CodeResult]],
    code: CodeRequest,
    suite: SemanticSuite,
) -> dict:
    """Run every case on the same sources via the isolated worker and assess."""
    if code.language != suite.language:
        raise ApiError(400, "SEMANTIC_SUITE_LANGUAGE", "语义套件与提交语言不一致。")

    case_results: list[dict] = []
    run_results: list[CodeResult] = []
    for case in (*suite.visible_cases, *suite.independent_cases):
        request = code.model_copy(update={"stdin": case.stdin})
        try:
            result = await run(request)
        except Exception:  # worker/transport failure: never judge the learner
            result = CodeResult(
                status="environment_error",
                phase="prepare",
                runtime_profile=suite.language + "-isolate-dev@0.1.0",
                request_sha256=request_hash(request),
            )
        if result.request_sha256 != request_hash(request):
            result = result.model_copy(
                update={
                    "status": "environment_error",
                    "phase": result.phase,
                    "request_sha256": request_hash(request),
                }
            )
        run_results.append(result)
        case_results.append(_assess_case(suite, case, result))

    def of_kind(kind: CaseKind) -> list[dict]:
        return [case for case in case_results if case["kind"] == kind]

    visible = of_kind("visible")
    independent = of_kind("independent")
    env_failed = any(case["status"] == "needs_review" for case in case_results)
    visible_met = [case for case in visible if case["status"] == "met"]
    independent_failed = [case for case in independent if case["status"] == "not_met"]
    all_met = all(case["status"] == "met" for case in case_results)
    suspected_hardcoding = bool(visible_met and independent_failed and not env_failed)

    if env_failed:
        fixed_status = "needs_review"
        fixed_reason = (
            "存在基础设施故障或不完整运行，本次不对固定/语义条件下结论，"
            "可在环境恢复后重新核验。"
        )
    elif all_met:
        fixed_status = "met"
        fixed_reason = "可见与独立输入在受信语义检查下均通过；仍只是有限用例，不证明一般正确。"
    elif suspected_hardcoding:
        fixed_status = "not_met"
        failed = ", ".join(case["stdin"].strip() for case in independent_failed)
        fixed_reason = (
            f"可见样例通过但独立输入（{failed}）失败，疑似只针对已展示样例硬编码结果。"
        )
    else:
        fixed_status = "not_met"
        fixed_reason = "存在未满足语义条件的输入，已给出反例；正常结束不等于任务正确。"

    independent_transfer_status = "needs_review"
    independent_transfer_reason = (
        "独立输入已全部通过，但有限用例仍不证明开放迁移与长期掌握，需独立复核。"
        if all(case["status"] == "met" for case in independent) and not env_failed
        else "独立输入尚未全部通过，不能判定独立迁移。"
    )

    return {
        "course_version_id": suite.course_version_id,
        "activity_version_id": suite.activity_version_id,
        "objective_code": suite.objective_code,
        "standard_version": suite.standard_version,
        "provenance": PROVENANCE,
        "comparator": suite.comparator,
        "oracle_id": suite.oracle_id,
        "scope_note": suite.scope_note,
        "suspected_hardcoding": suspected_hardcoding,
        "cases": case_results,
        # Execution fact for the first visible case (not a verdict); lets the
        # operation result stay shaped like a normal code run. Its request hash
        # must bind to the client-submitted artifact request (stdin is a
        # server-injected placeholder for suites), not to the per-case request
        # whose stdin was replaced above; per-case runner integrity is already
        # enforced in the loop.
        "representative_result": run_results[0]
        .model_copy(update={"request_sha256": request_hash(code)})
        .model_dump(),
        "criteria": [
            {"id": "fixed_condition", "status": fixed_status, "reason": fixed_reason},
            {"id": "explanation", "status": "needs_review", "reason": "解释笔记不是独立复核结论。"},
            {
                "id": "independent_transfer",
                "status": independent_transfer_status,
                "reason": independent_transfer_reason,
            },
        ],
        "mastery_asserted": False,
    }
