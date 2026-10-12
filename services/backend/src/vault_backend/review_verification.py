"""Authoritative server-side execution of synced work for human review.

A review may only cite a ``server_tool`` result the platform produced itself by
running the student's *synced* code through the isolated worker and a registered
checker (fixed-condition task or trusted semantic suite). A client upload, a
sync projection or a byte-for-byte consistent forgery therefore cannot obtain
``server_tool`` identity: the server always re-executes and records its own
result. When no checker applies, or the worker is unavailable, the caller must
ask for re-verification instead of upgrading the imported result.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from vault_backend.code_execution import CodeRequest
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_checks.semantic_suites import get_suite, run_suite
from vault_backend.course_checks.server_checks import DynamicCheckRegistry
from vault_backend.errors import ApiError

SUITE_CONTEXT_TASK_CODE = "semantic-suite"


@dataclass
class AuthoritativeVerifier:
    """Re-run synced work server-side and summarise the trusted outcome."""

    runner: Any
    check_registry: DynamicCheckRegistry

    def _suite(self, course_version_id: str, objective_code: str, activity_version_id: str):
        found = self.check_registry.get_suite(
            course_version_id, objective_code, activity_version_id
        )
        if found is not None:
            return found
        try:
            return get_suite(course_version_id, objective_code, activity_version_id)
        except ApiError:
            return None

    def _task(
        self, course_version_id: str, objective_code: str, task_code: str, activity_version_id: str
    ):
        found = self.check_registry.resolve_task(
            course_version_id, objective_code, task_code, activity_version_id
        )
        if found is not None:
            return found
        try:
            return resolve_task(course_version_id, objective_code, task_code, activity_version_id)
        except ApiError:
            return None

    async def run(
        self,
        code: CodeRequest,
        *,
        course_version_id: str,
        objective_code: str,
        activity_version_id: str,
        task_code: str,
    ) -> dict:
        """Execute the synced work server-side; return an authoritative summary."""
        if self.runner is None:
            raise ApiError(
                503,
                "CODE_WORKER_UNAVAILABLE",
                "服务端执行环境未配置，无法完成权威核验；请稍后重试。",
            )
        suite = self._suite(course_version_id, objective_code, activity_version_id)
        if task_code == SUITE_CONTEXT_TASK_CODE:
            if suite is None:
                raise ApiError(
                    422, "CHECK_UNAVAILABLE", "该作品没有登记受信语义核验套件。"
                )
            assessment = await run_suite(self.runner.run, code, suite)
            criteria = assessment["criteria"]
            return {
                "checker_kind": "semantic_suite",
                "standard_version": suite.standard_version,
                "outcome": _outcome(criteria),
                "detail": {
                    "criteria": criteria,
                    "suspected_hardcoding": assessment.get("suspected_hardcoding", False),
                    "oracle_id": suite.oracle_id,
                    "comparator": suite.comparator,
                    "checker_version": suite.standard_version,
                },
            }
        task = self._task(course_version_id, objective_code, task_code, activity_version_id)
        if task is None:
            raise ApiError(
                422, "CHECK_UNAVAILABLE", "该作品没有可用的受信固定条件核验。"
            )
        result = await self.runner.run(code)
        if result.status == "environment_error":
            raise ApiError(
                503,
                "CODE_WORKER_UNAVAILABLE",
                "服务端执行环境暂不可用，无法完成权威核验；请稍后重新提交。",
            )
        assessment = assess_task(task, code, result)
        criteria = assessment.criteria
        return {
            "checker_kind": "fixed_task",
            "standard_version": assessment.standard_version,
            "outcome": _outcome([criterion.model_dump() for criterion in criteria]),
            "detail": {
                "criteria": [criterion.model_dump() for criterion in criteria],
                "task_code": task.task_code,
                "checker_version": assessment.standard_version,
            },
        }


def _outcome(criteria: list[dict]) -> str:
    fixed = next(
        (
            criterion.get("status")
            for criterion in criteria
            if criterion.get("id") == "fixed_condition"
        ),
        "needs_review",
    )
    return fixed if fixed in {"met", "not_met", "needs_review"} else "needs_review"
