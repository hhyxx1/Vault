import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.course_packages import PublicCoursePackage

ROOT = Path(__file__).resolve().parents[3]


def test_cs04_each_goal_has_scoped_conditions_without_proof_claims():
    package = PublicCoursePackage.model_validate_json(
        (ROOT / "content/courses/CS04/CS04-core-practice-0.1.0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(package.activities) == len(package.objectives) == 27
    assert {a.objective_codes[0] for a in package.activities} == {
        o.code for o in package.objectives
    }
    assert package.curriculum_review_state == "unavailable"
    related = {end for relation in package.relations for end in (relation.from_, relation.to)}
    assert related == {o.code for o in package.objectives}
    for activity in package.activities:
        assert activity.code_request.language == "python313"
        for task in ["base", activity.variants[0].code]:
            resolved = resolve_task(
                package.course_version_id, activity.objective_codes[0], task, activity.version_id
            )
            assert resolved.standard_version == "code-fixed-condition-v1"


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires Linux isolate authoring",
)
async def test_cs04_real_python313_counterexamples_and_repaired_conditions():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS04-core.json").read_text(encoding="utf-8")
    )
    assert len(rows) == 108
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
        assert all(c["status"] == "needs_review" for c in assessment["criteria"][1:])
