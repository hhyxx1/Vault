"""Controlled authoring examples; execution is not independent mastery assessment."""

import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures/course-code/CS01-M02.json"
PUBLIC = (
    Path(__file__).resolve().parents[3]
    / "content/courses/CS01/CS01-core-practice-0.2.0/manifest.json"
)


def cases():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_types_module_covers_truncation_money_and_safe_boundary_changes():
    rows = cases()
    assert {row["id"] for row in rows} == {
        "temperature-integer",
        "temperature-floating",
        "negative-division",
        "money-whole-units",
        "money-cents",
        "money-discount",
        "truncate-positive",
        "truncate-negative",
        "safe-limit",
    }
    assert {row["goal"] for row in rows} == {"CS01-M02-O01", "CS01-M02-O02", "CS01-M02-O03"}
    for row in rows:
        assert CodeRequest.model_validate(row["request"]).language == "c17"
        assert row["expected"]["status"] == "success"


def test_public_types_tasks_use_checked_examples_and_keep_assessment_pending():
    from vault_backend.course_packages import PublicCoursePackage

    raw = json.loads(PUBLIC.read_text(encoding="utf-8"))
    package = PublicCoursePackage.model_validate(raw)
    ready = [a for a in package.activities if "CS01-M02" in a.code]
    assert len(ready) == 3
    requests = [row["request"] for row in cases()]
    for activity in ready:
        assert activity.availability == "practice_ready"
        assert activity.code_request.model_dump() in requests
        assert activity.reference_answer.model_dump() in requests
        assert activity.hints and activity.variants
        for variant in activity.variants:
            assert variant.code_request.model_dump() in requests
    for goal in package.objectives:
        if goal.code.startswith("CS01-M02"):
            assert all(c.verification == "activity_pending" for c in goal.criteria)


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires the dedicated Linux authoring execution worker",
)
async def test_types_module_actual_outputs_match_independent_expectations():
    for row in cases():
        result = await IsolateWorker().run(CodeRequest.model_validate(row["request"]))
        for field, expected in row["expected"].items():
            assert getattr(result, field) == expected, (row["id"], field, result)
        assert result.mastery_asserted is False
