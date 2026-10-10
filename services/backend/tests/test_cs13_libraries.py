import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]


def test_ml_library_labs_are_real_profile_variants_and_do_not_replace_old_experiments():
    package = PublicCoursePackage.model_validate_json(
        (ROOT / "content/courses/CS13/CS13-core-practice-0.3.0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(package.objectives) == 30 and len(package.activities) == 30
    selected = [v for a in package.activities for v in a.variants if v.code.startswith("library-")]
    assert len(selected) >= 7
    assert all(v.code_request.language == "python313ml" for v in selected)
    assert any(v.code == "pipeline-leak" for a in package.activities for v in a.variants)


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ML_INTEGRATION") != "1",
    reason="real pinned scientific sandbox",
)
async def test_actual_library_fitting_normal_and_counterexample_artifacts():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS13-libraries.json").read_text(
            encoding="utf-8"
        )
    )
    selected = [r for r in rows if r["request"]["language"] == "python313ml"]
    assert len(selected) >= 14
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
