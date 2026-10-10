import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "content/courses/CS01/CS01-core-practice-0.4.0/manifest.json"
FIXTURES = ROOT / "services/backend/fixtures/course-code/CS01-control.json"


def test_branch_and_loop_modules_have_real_tasks_and_version_bound_conditions():
    package = PublicCoursePackage.model_validate_json(PACKAGE.read_text(encoding="utf-8"))
    activities = [a for a in package.activities if a.code.startswith(("CS01-M03-", "CS01-M04-"))]
    assert len(activities) == 6
    for activity in activities:
        assert activity.hints and activity.reference_answer and activity.variants
        assert activity.availability == "practice_ready"
        for task in ["base", *(v.code for v in activity.variants)]:
            resolved = resolve_task(
                package.course_version_id, activity.objective_codes[0], task, activity.version_id
            )
            assert resolved.activity_version_id == activity.version_id


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring execution worker",
)
async def test_control_flow_artifacts_produce_actual_declared_feedback():
    rows = json.loads(FIXTURES.read_text(encoding="utf-8"))
    assert len(rows) >= 18
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        result = await IsolateWorker().run(request)
        for name, expected in row["expected"].items():
            assert getattr(result, name) == expected, (row["id"], name, result)
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"], row[
            "id"
        ]
