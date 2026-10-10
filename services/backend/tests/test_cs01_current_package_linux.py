"""Exercise every public current activity, including inherited artifact versions."""

import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker, request_hash
from vault_backend.course_checks.code_tasks import assess_task, resolve_task

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_every_current_public_artifact_matches_independent_authoring_decision():
    package = json.loads(
        (ROOT / "content/courses/CS01/CS01-core-practice-0.8.0/manifest.json").read_text(
            encoding="utf-8"
        )
    )
    expected = {}
    for name in (
        "CS01-control",
        "CS01-functions",
        "CS01-memory",
        "CS01-records",
        "CS01-files-testing",
    ):
        rows = json.loads(
            (ROOT / f"services/backend/fixtures/course-code/{name}.json").read_text(
                encoding="utf-8"
            )
        )
        for row in rows:
            expected[
                (row["goal"], row["task"], request_hash(CodeRequest.model_validate(row["request"])))
            ] = row["decision"]
    early_wrong = {"CS01-M01-O01", "CS01-M01-O02", "CS01-M02-O01", "CS01-M02-O02"}
    count = 0
    for activity in package["activities"]:
        goal = activity["objective_codes"][0]
        cases = [
            ("base", activity["code_request"], False),
            ("base", activity["reference_answer"], True),
            *((v["code"], v["code_request"], False) for v in activity["variants"]),
        ]
        for name, raw, answer in cases:
            request = CodeRequest.model_validate(raw)
            if goal.startswith(("CS01-M01-", "CS01-M02-")):
                decision = (
                    "met"
                    if answer
                    or (name != "base" and name != "wrong-output")
                    or (name == "base" and goal not in early_wrong)
                    else "not_met"
                )
            else:
                decision = expected[(goal, name, request_hash(request))]
            task = resolve_task(package["course_version_id"], goal, name, activity["version_id"])
            result = await IsolateWorker().run(request)
            assert assess_task(task, request, result)["criteria"][0]["status"] == decision, (
                goal,
                name,
                result,
            )
            count += 1
    assert len(package["activities"]) == 30
    assert count >= 100
