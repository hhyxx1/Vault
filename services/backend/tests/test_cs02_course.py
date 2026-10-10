import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]
PATH = ROOT / "content/courses/CS02/CS02-core-practice-0.1.0/manifest.json"


def test_cs02_all_module_goals_have_distinct_version_bound_practice():
    package = PublicCoursePackage.model_validate_json(PATH.read_text(encoding="utf-8"))
    assert len(package.objectives) == len(package.activities) == 24
    assert {a.objective_codes[0] for a in package.activities} == {
        o.code for o in package.objectives
    }
    for activity in package.activities:
        assert activity.code_request.language == "java21"
        assert activity.variants and activity.variants[0].reference_answer
        for task in ["base", *(v.code for v in activity.variants)]:
            resolved = resolve_task(
                package.course_version_id, activity.objective_codes[0], task, activity.version_id
            )
            assert resolved.standard_version == "code-fixed-condition-v1"
    assert package.curriculum_review_state == "unavailable"


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_cs02_real_java21_correct_and_wrong_cases():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS02-core.json").read_text(encoding="utf-8")
    )
    assert len(rows) == 96
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout, result.stderr) == ("success", row["stdout"], ""), (
            row["id"],
            result,
        )
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        assessment = assess_task(task, request, result)
        assert assessment["criteria"][0]["status"] == row["decision"]
        assert assessment["standard_version"] == "code-fixed-condition-v1"
        assert assessment["mastery_asserted"] is False
