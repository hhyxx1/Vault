import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]


def test_cpu_composite_preserves_goals_and_exposes_editable_actual_program():
    package = PublicCoursePackage.model_validate_json(
        (ROOT / "content/courses/CS06/CS06-core-practice-0.2.0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(package.objectives) == len(package.activities) == 27
    selected = [
        v for a in package.activities for v in a.variants if v.code.startswith("processor-")
    ]
    assert len(selected) >= 3
    assert all(
        "cpu.py" in v.code_request.files and "program.py" in v.code_request.files for v in selected
    )


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="actual CPU model in isolated worker",
)
async def test_cpu_project_actual_all_versioned_code_conditions():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS06-project.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        result = await IsolateWorker(box_id=701).run(request)
        assert (result.status, result.stdout, result.stderr) == ("success", row["stdout"], ""), (
            row["id"],
            result,
        )
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        assessment = assess_task(task, request, result)
        assert assessment["criteria"][0]["status"] == row["decision"]
        assert all(c["status"] == "needs_review" for c in assessment["criteria"][1:])
