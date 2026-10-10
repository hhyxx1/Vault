"""Execute trusted course authoring artifacts on the dedicated Linux worker."""

import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker
from vault_backend.course_checks.code_tasks import assess_task, resolve_task


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires the dedicated Linux authoring execution worker",
)
async def test_all_public_registered_tasks_compare_actual_outputs_against_trusted_rules():
    path = (
        Path(__file__).resolve().parents[3]
        / "content/courses/CS01/CS01-core-practice-0.3.0/manifest.json"
    )
    package = json.loads(path.read_text(encoding="utf-8"))
    wrong_starters = {"CS01-M01-O01", "CS01-M01-O02", "CS01-M02-O01", "CS01-M02-O02"}
    count = 0
    for activity in package["activities"]:
        goal = activity["objective_codes"][0]
        cases = [
            ("base", activity["code_request"], "not_met" if goal in wrong_starters else "met"),
            ("base", activity["reference_answer"], "met"),
            *[
                (v["code"], v["code_request"], "not_met" if v["code"] == "wrong-output" else "met")
                for v in activity["variants"]
            ],
        ]
        for variant, raw, expected in cases:
            request = CodeRequest.model_validate(raw)
            task = resolve_task(package["course_version_id"], goal, variant, activity["version_id"])
            result = await IsolateWorker().run(request)
            feedback = assess_task(task, request, result)
            assert feedback["criteria"][0]["status"] == expected, (goal, variant, result)
            assert feedback["mastery_asserted"] is False
            count += 1
    assert count == 20
