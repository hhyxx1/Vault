"""Acceptance tests for the CS03 heap-based priority-queue activity."""

import importlib
import importlib.util
import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RELEASE = "CS03-core-practice-0.6.0"


def test_current_cs03_release_contains_a_distinct_priority_queue_goal():
    catalog = json.loads((ROOT / "content/courses/scope-catalog.json").read_text(encoding="utf-8"))
    current = next(course for course in catalog["courses"] if course["code"] == "CS03")
    assert current["version"] == RELEASE

    package = json.loads((ROOT / "content/courses" / current["package_path"]).read_text(encoding="utf-8"))
    objective = next(item for item in package["objectives"] if item["code"] == "CS03-M03-O04")
    assert "优先队列" in objective["title"]

    activity = next(item for item in package["activities"] if item["objective_codes"] == [objective["code"]])
    assert activity["kind"] == "code"
    assert activity["semantic_suite"]["oracle_id"] == "cs03_priority_queue"
    assert all(word in " ".join(activity["theory"]) for word in ("push", "top", "pop", "size"))
    assert "ods-priority-queue" in activity["source_refs"]
    assert activity["semantic_suite"]["independent_case_count"] >= 3


def test_priority_queue_oracle_covers_empty_duplicates_and_negative_priorities():
    module_name = "vault_backend.course_checks.cs03_priority_queue"
    assert importlib.util.find_spec(module_name) is not None, "the audited priority-queue oracle is missing"
    model = importlib.import_module(module_name).priority_queue_model
    assert model(
        "top\npop\nsize\npush 8\npush -3\npush 4\npush -3\ntop\npop\ntop\npop\npop\npop\npop\n"
    ) == "empty\nempty\n0\nok\nok\nok\nok\n-3\n-3\n-3\n-3\n4\n8\nempty\n"


def test_priority_queue_is_registered_for_current_course_activity_and_fixed_check():
    from vault_backend.course_checks import code_tasks, cs03_priority_queue, cs03_union_find_radix, semantic_suites

    activity_id = cs03_union_find_radix.activity_id(cs03_priority_queue.OBJECTIVE)
    suite = semantic_suites.get_suite(
        cs03_union_find_radix.COURSE_VERSION,
        cs03_priority_queue.OBJECTIVE,
        activity_id,
    )
    assert suite.oracle_id == cs03_priority_queue.ORACLE_ID
    assert len(suite.visible_cases) == 2
    assert len(suite.independent_cases) >= 3
    fixed = code_tasks.resolve_task(
        cs03_union_find_radix.COURSE_VERSION,
        cs03_priority_queue.OBJECTIVE,
        "base",
        activity_id,
    )
    assert fixed.stdout == cs03_priority_queue.priority_queue_model(fixed.stdin)


def test_reference_priority_queue_compiles_and_matches_its_operation_model(tmp_path):
    source = ROOT / "tools/curriculum/cs03/priority_queue.cpp"
    assert source.is_file(), "the course's reference heap implementation is missing"
    executable = tmp_path / ("priority_queue.exe" if os.name == "nt" else "priority_queue")
    build = subprocess.run(
        ["g++", "-std=c++17", "-O2", str(source), "-o", str(executable)],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "TMPDIR": str(tmp_path), "TMP": str(tmp_path), "TEMP": str(tmp_path)},
    )
    assert build.returncode == 0, build.stderr

    from vault_backend.course_checks.cs03_priority_queue import priority_queue_model

    stdin = "push 5\npush -1\npush 5\ntop\npop\nsize\npop\npop\npop\n"
    result = subprocess.run(
        [str(executable)], input=stdin, capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == priority_queue_model(stdin)
