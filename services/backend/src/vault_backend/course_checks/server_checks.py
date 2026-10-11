"""Data-driven, server-private course checks shipped alongside public packages.

The public ``manifest.json`` only *announces* trusted verification: it carries
the visible learning cases and the *count* of independent cases for a semantic
suite, but never the oracle, expected outputs or independent inputs (see
``PublicSemanticSuite``).  Historically the trusted part was frozen into
backend Python (``generic_rules.py`` / ``semantic_suites.SUITES``), which meant
every new course required editing backend whitelists.

This module loads a **server-only sidecar** named ``server-expectations.json``
that lives in the same version directory as ``manifest.json``.  It contains
plain *data* only:

* fixed-condition expectations (stdin + expected status/stdout/stderr), judged
  by the generic immutable stdout comparator -- never uploaded code; and
* the independent semantic inputs, paired at load time with the oracle id and
  visible cases already declared in the public manifest.

There is deliberately no field for executable Python, a checker module path or
an arbitrary oracle.  A suite may only reference an oracle id from the trusted
in-process ``ORACLES`` whitelist, and a fixed condition is compared by the
existing deterministic checker.  Teacher/self-built courses therefore reuse
platform-registered tools and cannot turn package upload into arbitrary
server-side grading code.

The sidecar is never served by the public catalog/version endpoints and does
not match the front-end bundle glob (only ``manifest.json`` / ``*-example.json``
do).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from vault_backend.course_checks.code_tasks import Task
from vault_backend.course_checks.semantic_suites import (
    ORACLES,
    SemanticSuite,
    SuiteCase,
)

SIDECAR_FILENAME = "server-expectations.json"

# Keep in lock-step with ``PublicSemanticSuite.comparator`` and the trusted
# ``_compare`` modes in semantic_suites.py.
COMPARATORS = frozenset(
    {"exact", "integer", "number_tol", "token_multiset", "line_set", "sorted_lines"}
)

# Outcomes a fixed condition may legitimately expect. ``environment_error`` is
# intentionally excluded: an infrastructure failure must never be authored as
# the "correct" expectation for a learner task.
_FIXED_STATUSES = frozenset(
    {"success", "compile_error", "runtime_error", "timeout", "resource_limit"}
)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ServerFixedCondition(_Strict):
    """A trusted fixed condition, expressed purely as expected data."""

    activity_version_id: str = Field(min_length=1, max_length=80)
    objective_code: str = Field(min_length=1, max_length=80)
    task_code: str = Field(min_length=1, max_length=80)
    stdin: str = Field(default="", max_length=16384)
    status: Literal[
        "success", "compile_error", "runtime_error", "timeout", "resource_limit"
    ]
    stdout: str = Field(default="", max_length=8192)
    stderr: str = Field(default="", max_length=8192)


class ServerCaseInput(_Strict):
    code: str = Field(min_length=1, max_length=100)
    stdin: str = Field(default="", max_length=16384)


class ServerSemanticSuite(_Strict):
    """Independent inputs for a suite announced in the public manifest."""

    activity_version_id: str = Field(min_length=1, max_length=80)
    objective_code: str = Field(min_length=1, max_length=80)
    independent_cases: list[ServerCaseInput] = Field(min_length=1, max_length=100)


class ServerExpectations(_Strict):
    """Server-private trusted expectations for one immutable course version."""

    course_id: str = Field(min_length=1)
    course_version_id: str = Field(min_length=1)
    course_code: str = Field(min_length=1, max_length=40)
    fixed_conditions: list[ServerFixedCondition] = Field(default_factory=list)
    semantic_suites: list[ServerSemanticSuite] = Field(default_factory=list)


def _activities_by_version(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    activities: dict[str, dict[str, Any]] = {}
    for activity in manifest.get("activities", []) or []:
        version_id = activity.get("version_id")
        if isinstance(version_id, str):
            activities[version_id] = activity
    return activities


def _validate_against_manifest(
    expectations: ServerExpectations, manifest: dict[str, Any]
) -> None:
    activities = _activities_by_version(manifest)

    fixed_keys: set[tuple[str, str, str]] = set()
    for condition in expectations.fixed_conditions:
        activity = activities.get(condition.activity_version_id)
        if activity is None or activity.get("kind") != "code":
            raise ValueError(
                "Server fixed condition must reference a code activity version "
                f"in the manifest: {condition.activity_version_id}"
            )
        if condition.objective_code not in (activity.get("objective_codes") or []):
            raise ValueError(
                "Server fixed condition objective is not covered by its activity: "
                f"{condition.objective_code}"
            )
        key = (
            condition.activity_version_id,
            condition.objective_code,
            condition.task_code,
        )
        if key in fixed_keys:
            raise ValueError(f"Duplicate server fixed condition: {key}")
        fixed_keys.add(key)

    suite_keys: set[tuple[str, str]] = set()
    for declared in expectations.semantic_suites:
        activity = activities.get(declared.activity_version_id)
        if activity is None or activity.get("kind") != "code":
            raise ValueError(
                "Server semantic suite must reference a code activity version "
                f"in the manifest: {declared.activity_version_id}"
            )
        if declared.objective_code not in (activity.get("objective_codes") or []):
            raise ValueError(
                "Server semantic suite objective is not covered by its activity: "
                f"{declared.objective_code}"
            )
        public_suite = activity.get("semantic_suite")
        if not isinstance(public_suite, dict):
            raise ValueError(
                "Server semantic suite requires a semantic_suite announcement "
                "in the public manifest"
            )
        expected_count = public_suite.get("independent_case_count")
        if len(declared.independent_cases) != expected_count:
            raise ValueError(
                "Server independent case count "
                f"({len(declared.independent_cases)}) must match the public "
                f"manifest independent_case_count ({expected_count})"
            )
        codes = [case.code for case in declared.independent_cases]
        if len(set(codes)) != len(codes):
            raise ValueError("Duplicate independent semantic case code")
        visible_codes = {
            case.get("code") for case in public_suite.get("visible_cases", [])
        }
        if any(code in visible_codes for code in codes):
            raise ValueError("Independent case codes must not reuse visible codes")
        key = (declared.activity_version_id, declared.objective_code)
        if key in suite_keys:
            raise ValueError(f"Duplicate server semantic suite: {key}")
        suite_keys.add(key)
        # Fail fast if the manifest references an oracle/comparator that is not
        # in the trusted in-process whitelist.
        oracle_id = public_suite.get("oracle_id")
        if oracle_id not in ORACLES or public_suite.get("comparator") not in COMPARATORS:
            raise ValueError(
                f"Semantic suite references an untrusted oracle/comparator: "
                f"{oracle_id} / {public_suite.get('comparator')}"
            )


def load_server_expectations(
    package_dir: Path, manifest: dict[str, Any]
) -> ServerExpectations | None:
    """Load and validate the private sidecar for one package directory.

    Returns ``None`` when no sidecar exists (a course may rely solely on the
    frozen registries).  Raises ``ValueError`` when a sidecar is present but
    malformed or inconsistent with its public manifest so that authoring-time
    tests fail loudly; the repository loader fails closed per package at runtime.
    """

    path = package_dir / SIDECAR_FILENAME
    if not path.is_file():
        return None
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    expectations = ServerExpectations.model_validate(raw)
    identity = (
        expectations.course_id,
        expectations.course_version_id,
        expectations.course_code,
    )
    if identity != (
        str(manifest.get("course_id")),
        str(manifest.get("course_version_id")),
        manifest.get("course_code"),
    ):
        raise ValueError("Server expectations identity does not match the manifest")
    _validate_against_manifest(expectations, manifest)
    return expectations


class DynamicCheckRegistry:
    """Resolves trusted checks from validated package sidecars at runtime.

    Lookups return ``None`` on miss so callers can fall back to the immutable
    frozen registries.  This registry never executes anything from a package;
    suites reuse whitelisted oracles and fixed conditions reuse the built-in
    stdout comparator.
    """

    def __init__(
        self,
        loaded: list[tuple[dict[str, Any], ServerExpectations]] | None = None,
    ) -> None:
        # (course_version_id, objective, task_code) -> fixed condition
        self._tasks: dict[tuple[str, str, str], ServerFixedCondition] = {}
        # (course_version_id, objective) -> resolved suite
        self._suites: dict[tuple[str, str], SemanticSuite] = {}
        for manifest, expectations in loaded or []:
            self._add(manifest, expectations)

    def _add(
        self, manifest: dict[str, Any], expectations: ServerExpectations
    ) -> None:
        version_id = str(manifest["course_version_id"])
        for condition in expectations.fixed_conditions:
            self._tasks[
                (version_id, condition.objective_code, condition.task_code)
            ] = condition
        activities = _activities_by_version(manifest)
        for declared in expectations.semantic_suites:
            activity = activities[declared.activity_version_id]
            public_suite = activity["semantic_suite"]
            visible = tuple(
                SuiteCase(case["code"], "visible", case["stdin"])
                for case in public_suite["visible_cases"]
            )
            independent = tuple(
                SuiteCase(case.code, "independent", case.stdin)
                for case in declared.independent_cases
            )
            suite = SemanticSuite(
                course_version_id=version_id,
                objective_code=declared.objective_code,
                activity_version_id=declared.activity_version_id,
                language=public_suite["language"],
                oracle_id=public_suite["oracle_id"],
                comparator=public_suite["comparator"],
                visible_cases=visible,
                independent_cases=independent,
                scope_note=public_suite["scope_note"],
            )
            self._suites[(version_id, declared.objective_code)] = suite

    def resolve_task(
        self,
        course_version_id: str,
        objective_code: str,
        task_code: str,
        activity_version_id: str | None = None,
    ) -> Task | None:
        condition = self._tasks.get((course_version_id, objective_code, task_code))
        if condition is None:
            return None
        if (
            activity_version_id is not None
            and activity_version_id != condition.activity_version_id
        ):
            return None
        return Task(
            course_version_id=course_version_id,
            objective_code=objective_code,
            task_code=task_code,
            stdin=condition.stdin,
            status=condition.status,
            stdout=condition.stdout,
            stderr=condition.stderr,
            activity_version_id=condition.activity_version_id,
            standard_version="code-fixed-condition-v1",
        )

    def get_suite(
        self,
        course_version_id: str,
        objective_code: str,
        activity_version_id: str | None = None,
    ) -> SemanticSuite | None:
        suite = self._suites.get((course_version_id, objective_code))
        if suite is None:
            return None
        if (
            activity_version_id is not None
            and activity_version_id != suite.activity_version_id
        ):
            return None
        return suite
