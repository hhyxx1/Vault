import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage
from vault_backend.errors import ApiError

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "content/courses/CS01/CS01-core-practice-0.5.0/manifest.json"


def test_control_version_cannot_execute_later_function_tasks():
    with pytest.raises(ApiError):
        resolve_task("fc44376d-c32e-58ed-a4cf-9f98b5a80811", "CS01-M05-O01", "base")


def test_function_goals_are_real_version_bound_activities():
    package = PublicCoursePackage.model_validate_json(PACKAGE.read_text(encoding="utf-8"))
    activities = [a for a in package.activities if a.code.startswith("CS01-M05-")]
    assert len(activities) == 3
    for activity in activities:
        assert activity.hints and activity.reference_answer and activity.variants
        for name in ["base", *(v.code for v in activity.variants)]:
            task = resolve_task(
                package.course_version_id, activity.objective_codes[0], name, activity.version_id
            )
            assert task.activity_version_id == activity.version_id


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring execution worker",
)
async def test_function_artifacts_against_independent_expected_outputs():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS01-functions.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(rows) >= 12
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout) == ("success", row["stdout"]), row["id"]
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"]
