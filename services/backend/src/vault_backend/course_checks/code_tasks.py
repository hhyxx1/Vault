"""Trusted fixed-condition comparisons, never general correctness or mastery."""

from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
from vault_backend.errors import ApiError

STANDARD = "cs01-fixed-condition-v1"
ACTIVITIES = dict(
    zip(
        [f"CS01-M{module:02d}-O{goal:02d}" for module in (1, 2) for goal in (1, 2, 3)],
        [
            "8aa993d0-d813-55e7-b40b-b2a246ad5224",
            "07fe337c-cafd-550c-ac1c-4ac964b005f6",
            "0be2be79-7972-57ef-823d-a9c9d7027cc3",
            "dd4fbd97-f918-5ea0-be35-bd99fbc81456",
            "ae40b05b-362b-56fb-8699-f184df715d98",
            "99b34641-7ae9-5ac3-90fd-0421bff03563",
        ],
        strict=True,
    )
)

VERSION_ACTIVITIES = {
    "ad970167-0230-5141-8027-cc535f3ed22e": ACTIVITIES,
    "93d59075-447d-55d5-a54b-d151c0aaa2a1": {
        goal: str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.2.0")) for goal in ACTIVITIES
    },
}
VERSION_ACTIVITIES["fc44376d-c32e-58ed-a4cf-9f98b5a80811"] = {
    **VERSION_ACTIVITIES["93d59075-447d-55d5-a54b-d151c0aaa2a1"],
    **{
        f"CS01-M{module:02d}-O{goal:02d}": str(
            uuid5(NAMESPACE_URL, f"vault:CS01-M{module:02d}-O{goal:02d}-CODE:0.1.0")
        )
        for module in (3, 4)
        for goal in (1, 2, 3)
    },
}


@dataclass(frozen=True)
class Task:
    course_version_id: str
    objective_code: str
    task_code: str
    stdin: str
    status: str
    stdout: str
    stderr: str = ""
    activity_version_id: str = ""


# Authored independently from submitted source; no uploaded grading programs.
RULES = {
    ("CS01-M01-O01", "base"): ("", "success", "Hello, learner!\n", ""),
    ("CS01-M01-O01", "wrong-output"): ("", "success", "5\n", ""),
    ("CS01-M01-O02", "base"): ("", "success", "5\n", ""),
    ("CS01-M01-O02", "nonzero-exit"): ("", "runtime_error", "Hello, learner!\n", ""),
    ("CS01-M01-O03", "base"): ("A", "success", "accepted\n", ""),
    ("CS01-M01-O03", "input-rejected"): ("B", "runtime_error", "", "expected A\n"),
    ("CS01-M01-O03", "input-empty"): ("", "runtime_error", "", "expected A\n"),
    ("CS01-M02-O01", "base"): ("", "success", "10.00\n", ""),
    ("CS01-M02-O01", "negative-division"): ("", "success", "-2 -1\n", ""),
    ("CS01-M02-O02", "base"): ("", "success", "5.97\n", ""),
    ("CS01-M02-O02", "money-discount"): ("", "success", "5.37\n", ""),
    ("CS01-M02-O03", "base"): ("", "success", "3\n", ""),
    ("CS01-M02-O03", "truncate-negative"): ("", "success", "-3\n", ""),
    ("CS01-M02-O03", "safe-limit"): ("", "success", "addition rejected\n", ""),
    ("CS01-M03-O01", "base"): ("", "success", "free\n", ""),
    ("CS01-M03-O01", "above-all"): ("", "success", "full\n", ""),
    ("CS01-M03-O02", "base"): ("", "success", "0\n", ""),
    ("CS01-M03-O02", "upper-equal"): ("", "success", "5\n", ""),
    ("CS01-M03-O03", "base"): ("", "success", "5\n", ""),
    ("CS01-M03-O03", "minutes-29"): ("", "success", "0\n", ""),
    ("CS01-M03-O03", "minutes-30"): ("", "success", "0\n", ""),
    ("CS01-M03-O03", "minutes-31"): ("", "success", "5\n", ""),
    ("CS01-M03-O03", "minutes-59"): ("", "success", "5\n", ""),
    ("CS01-M03-O03", "minutes-61"): ("", "success", "10\n", ""),
    ("CS01-M03-O03", "changed-policy"): ("", "success", "5\n", ""),
    ("CS01-M04-O01", "base"): ("", "success", "1 1\n2 3\n3 6\n", ""),
    ("CS01-M04-O01", "empty-range"): ("", "success", "", ""),
    ("CS01-M04-O02", "base"): ("", "success", "3\n2\n1\n", ""),
    ("CS01-M04-O02", "zero-start"): ("", "success", "", ""),
    ("CS01-M04-O03", "base"): (
        "-0+#",
        "success",
        "step=1 sum=-1\nstep=2 sum=-1\nstep=3 sum=0\nsum=0 count=3\n",
        "",
    ),
    ("CS01-M04-O03", "end-only"): ("#", "success", "sum=0 count=0\n", ""),
    ("CS01-M04-O03", "empty-input"): ("", "success", "sum=0 count=0\n", ""),
    ("CS01-M04-O03", "ignore-after-end"): ("-#+", "success", "step=1 sum=-1\nsum=-1 count=1\n", ""),
}


RULES[("CS01-M04-O02", "missing-termination")] = ("", "success", "3\n2\n1\n", "")


def resolve_task(
    course_version_id: str,
    objective_code: str,
    task_code: str,
    activity_version_id: str | None = None,
) -> Task:
    rule = RULES.get((objective_code, task_code))
    expected_activity = VERSION_ACTIVITIES.get(course_version_id, {}).get(objective_code)
    if (
        expected_activity is None
        or rule is None
        or (activity_version_id is not None and expected_activity != activity_version_id)
    ):
        raise ApiError(404, "CODE_TASK_UNAVAILABLE", "该版本没有登记此固定条件核验。")
    return Task(
        course_version_id, objective_code, task_code, *rule, activity_version_id=expected_activity
    )


def assess_task(task: Task, request: CodeRequest, result: CodeResult) -> dict:
    complete = (
        result.status != "environment_error"
        and result.phase != "cleanup"
        and not result.truncated
        and result.request_sha256 == request_hash(request)
        and request.stdin == task.stdin
    )
    matched = (result.status, result.stdout, result.stderr) == (
        task.status,
        task.stdout,
        task.stderr,
    )
    outcome = "needs_review" if not complete else "met" if matched else "not_met"
    reason = (
        "环境故障、输出不完整、作品或输入条件不一致，未作能力判断。"
        if not complete
        else "本次状态与输出满足指定固定条件；仍需解释和独立迁移。"
        if matched
        else "本次状态或输出不满足任务条件；正常结束不等于任务正确。"
    )
    return {
        "course_version_id": task.course_version_id,
        "activity_version_id": task.activity_version_id,
        "objective_code": task.objective_code,
        "task_code": task.task_code,
        "standard_version": STANDARD,
        "provenance": "server_deterministic_checker",
        "criteria": [
            {"id": "fixed_condition", "status": outcome, "reason": reason},
            {"id": "explanation", "status": "needs_review", "reason": "解释笔记不是独立复核结论。"},
            {
                "id": "independent_transfer",
                "status": "needs_review",
                "reason": "固定条件比较不证明新条件下的独立能力。",
            },
        ],
        "mastery_asserted": False,
    }
