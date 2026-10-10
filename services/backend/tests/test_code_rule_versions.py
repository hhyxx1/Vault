import json
from pathlib import Path

import pytest

from vault_backend.course_checks import code_tasks
from vault_backend.errors import ApiError

VERSION = "ad970167-0230-5141-8027-cc535f3ed22e"
GOAL = "CS01-M01-O01"


def test_new_rule_does_not_become_available_in_published_version(monkeypatch):
    monkeypatch.setitem(code_tasks.RULES, (GOAL, "future-task"), ("", "success", "new\n", ""))
    with pytest.raises(ApiError):
        code_tasks.resolve_task(VERSION, GOAL, "future-task")


def test_published_comparison_survives_shared_rule_changes(monkeypatch):
    original = code_tasks.resolve_task(VERSION, GOAL, "base")
    monkeypatch.setitem(code_tasks.RULES, (GOAL, "base"), ("changed", "success", "new\n", ""))
    assert code_tasks.resolve_task(VERSION, GOAL, "base") == original


def test_all_published_versions_register_exact_public_tasks():
    root = Path(__file__).resolve().parents[3]
    seen = set()
    for path in (root / "content/courses/CS01").glob("*/manifest.json"):
        package = json.loads(path.read_text(encoding="utf-8"))
        version = package["course_version_id"]
        if version not in code_tasks.VERSION_ACTIVITIES:
            continue
        seen.add(version)
        expected = set()
        for activity in package["activities"]:
            goal = activity["objective_codes"][0]
            if goal not in code_tasks.VERSION_ACTIVITIES[version]:
                continue
            for task in ["base", *(v["code"] for v in activity.get("variants", []))]:
                expected.add((goal, task))
                resolved = code_tasks.resolve_task(version, goal, task, activity["version_id"])
                assert resolved.activity_version_id == activity["version_id"]
        assert set(code_tasks.PUBLISHED_RULES[version]) == expected
    assert seen == set(code_tasks.VERSION_ACTIVITIES) == set(code_tasks.PUBLISHED_RULES)
