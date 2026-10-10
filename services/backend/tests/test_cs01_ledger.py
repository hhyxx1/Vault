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
PACKAGE = ROOT / "content/courses/CS01/CS01-core-practice-0.9.0/manifest.json"


def test_ledger_is_versioned_combination_with_bounded_claim():
    package = PublicCoursePackage.model_validate_json(PACKAGE.read_text(encoding="utf-8"))
    activity = next(a for a in package.activities if a.code == "CS01-M10-O03-CODE")
    variants = {v.code: v for v in activity.variants}
    assert {"ledger-recovery", "ledger-empty", "ledger-boundary"} <= variants.keys()
    assert activity.objective_codes == ["CS01-M10-O03"]
    for name in ("ledger-recovery", "ledger-empty", "ledger-boundary"):
        assert variants[name].code_request.language == "c17"
        resolve_task(
            package.course_version_id, activity.objective_codes[0], name, activity.version_id
        )
    assert package.curriculum_review_state == "unavailable"


def test_previous_course_version_cannot_run_new_combination_task():
    with pytest.raises(ApiError):
        resolve_task("87b9961f-90e6-5e5b-8e27-44f9901e843c", "CS01-M10-O03", "ledger-recovery")


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires dedicated Linux authoring worker",
)
async def test_ledger_real_file_round_trip_and_rejection_preserve_state():
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS01-ledger.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(rows) == 6
    for row in rows:
        request = CodeRequest.model_validate(row["request"])
        result = await IsolateWorker().run(request)
        assert (result.status, result.stdout, result.stderr) == ("success", row["stdout"], ""), row[
            "id"
        ]
        task = resolve_task(row["version"], row["goal"], row["task"], row["activity"])
        assert assess_task(task, request, result)["criteria"][0]["status"] == row["decision"]
