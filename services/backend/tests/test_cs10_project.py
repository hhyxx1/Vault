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


def test_submission_project_is_versioned_and_keeps_each_goal_independent():
    package = PublicCoursePackage.model_validate_json(
        (ROOT / "content/courses/CS10/CS10-core-practice-0.2.0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    activity = next(a for a in package.activities if a.code == "CS10-M09-O03-CODE")
    assert activity.objective_codes == ["CS10-M09-O03"]
    for task in ("service-owner", "service-replay"):
        variant = next(v for v in activity.variants if v.code == task)
        assert set(variant.code_request.files) == {"main.py", "service.py"}
        resolve_task(package.course_version_id, "CS10-M09-O03", task, activity.version_id)
        with pytest.raises(ApiError):
            resolve_task("10f64de2-acaf-5de8-8d02-dda9422af822", "CS10-M09-O03", task)


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="real Linux isolate",
)
async def test_actual_submission_pipeline_counterexample_repairs_and_finite_variants():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS10-project.json").read_text(
            encoding="utf-8"
        )
    )
    selected = [r for r in rows if r["task"].startswith("service-")]
    assert len(selected) == 4
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
