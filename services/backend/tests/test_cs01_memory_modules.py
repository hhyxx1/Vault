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
PACKAGE = ROOT / "content/courses/CS01/CS01-core-practice-0.6.0/manifest.json"


def test_memory_modules_publish_safe_artifacts_and_explicit_version_binding():
    package = PublicCoursePackage.model_validate_json(PACKAGE.read_text(encoding="utf-8"))
    activities = [a for a in package.activities if a.code.startswith(("CS01-M06-", "CS01-M07-"))]
    assert len(activities) == 6
    for activity in activities:
        assert activity.hints and activity.reference_answer and activity.variants
        for name in ["base", *(v.code for v in activity.variants)]:
            task = resolve_task(
                package.course_version_id, activity.objective_codes[0], name, activity.version_id
            )
            assert task.activity_version_id == activity.version_id
    with pytest.raises(ApiError):
        resolve_task("21b3d7a3-609a-508a-923c-ea92cc1a32ef", "CS01-M06-O01", "base")


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_array_string_and_ownership_artifacts_execute_expected_paths():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS01-memory.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(rows) >= 24
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout, result.stderr) == ("success", row["stdout"], ""), row[
            "id"
        ]
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"]
