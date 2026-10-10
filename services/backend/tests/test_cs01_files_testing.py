import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "content/courses/CS01/CS01-core-practice-0.8.0/manifest.json"


def test_file_and_regression_goals_have_versioned_executable_tasks():
    package = PublicCoursePackage.model_validate_json(PACKAGE.read_text(encoding="utf-8"))
    assert len(package.activities) == 30
    goals = [a for a in package.activities if a.code.startswith(("CS01-M09-", "CS01-M10-"))]
    assert len(goals) == 6
    for activity in goals:
        for name in ["base", *(v.code for v in activity.variants)]:
            assert (
                resolve_task(
                    package.course_version_id,
                    activity.objective_codes[0],
                    name,
                    activity.version_id,
                ).activity_version_id
                == activity.version_id
            )


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_real_file_operations_and_regression_artifacts_match_declared_results():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS01-files-testing.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(rows) >= 24
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout) == ("success", row["stdout"]), row["id"]
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"]
