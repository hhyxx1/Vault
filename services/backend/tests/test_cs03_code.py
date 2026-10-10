import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]
PATH = ROOT / "content/courses/CS03/CS03-core-practice-0.1.0/manifest.json"


def test_cs03_data_operations_are_bound_to_their_own_goals():
    package = PublicCoursePackage.model_validate_json(PATH.read_text(encoding="utf-8"))
    assert len(package.objectives) == 30
    assert len(package.activities) == 9
    for activity in package.activities:
        assert activity.code_request.language == "cpp17"
        assert len(activity.variants) == 1
        for task in ["base", activity.variants[0].code]:
            resolved = resolve_task(
                package.course_version_id, activity.objective_codes[0], task, activity.version_id
            )
            assert resolved.standard_version == "code-fixed-condition-v1"
    assert package.curriculum_review_state == "unavailable"


def test_cs03_remaining_modules_have_individual_executable_conditions():
    path = ROOT / "content/courses/CS03/CS03-core-practice-0.2.0/manifest.json"
    package = PublicCoursePackage.model_validate_json(path.read_text(encoding="utf-8"))
    assert len(package.objectives) == len(package.activities) == 30
    goals = {o.code for o in package.objectives}
    assert {a.objective_codes[0] for a in package.activities} == goals
    related = set()
    for relation in package.relations:
        serialized = relation.model_dump(by_alias=True)
        related.update([serialized["from"], serialized["to"]])
        assert serialized["kind"] != "mandatory_prerequisite"
    assert related == goals
    for activity in package.activities:
        for task in ["base", activity.variants[0].code]:
            resolved = resolve_task(
                package.course_version_id, activity.objective_codes[0], task, activity.version_id
            )
            assert resolved.standard_version == "code-fixed-condition-v1"


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_cs03_all_modules_real_cpp17():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS03-core.json").read_text(encoding="utf-8")
    )
    assert len(rows) == 120
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout, result.stderr) == ("success", row["stdout"], ""), (
            row["id"],
            result,
        )
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"]


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_cs03_real_cpp17_data_operations_and_boundaries():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS03-linear.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(rows) == 36
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout, result.stderr) == ("success", row["stdout"], ""), (
            row["id"],
            result,
        )
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"]
