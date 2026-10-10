import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]


def test_actual_flow_package_keeps_all_goals_and_has_reverse_capacity_experiment():
    package = PublicCoursePackage.model_validate_json(
        (ROOT / "content/courses/CS04/CS04-core-practice-0.2.0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(package.objectives) == len(package.activities) == 27
    variants = [v for a in package.activities for v in a.variants if v.code.startswith("flow-")]
    assert len(variants) == 2
    assert all("flow.py" in v.code_request.files for v in variants)


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="actual flow in isolated runtime",
)
async def test_flow_all_author_artifacts_on_actual_worker():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS04-project.json").read_text(
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
