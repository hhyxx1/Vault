from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.checker import verify_truth_table
from vault_backend.content import CourseRepository
from vault_backend.schemas import TruthTableSubmission
from vault_backend.sync_schemas import CourseAttemptPayload


def test_course_attempt_sync_accepts_draft_and_bounded_checker_report(settings):
    context = CourseRepository(settings.course_catalog_path).logic_context
    assert context is not None
    now = datetime.now(UTC).isoformat()
    attempt = {
        "id": str(uuid4()),
        "spaceId": str(uuid4()),
        "artifactId": str(uuid4()),
        "objectiveId": "CS05-LOGIC-01",
        "courseCode": "CS05",
        "activityVersion": "CS05-LOGIC-01-TABLE@0.1.0",
        "rows": [
            {"implication": True, "contrapositive": True, "biconditional": True},
            {"implication": True, "contrapositive": True, "biconditional": False},
            {"implication": False, "contrapositive": False, "biconditional": False},
            {"implication": True, "contrapositive": True, "biconditional": True},
        ],
        "explanation": "P 真 Q 假时蕴含为假。",
        "result": None,
        "createdAt": now,
        "updatedAt": now,
    }
    assert CourseAttemptPayload.model_validate(attempt).result is None
    submission = TruthTableSubmission.model_validate(
        {
            "kind": "verify_truth_table",
            "course_code": "CS05",
            "activity_version": attempt["activityVersion"],
            "standard_version": "propositional-table-v1",
            "client_artifact_id": attempt["artifactId"],
            "client_revision_id": attempt["id"],
            "rows": attempt["rows"],
            "explanation": attempt["explanation"],
        }
    )
    result = {**verify_truth_table(submission), **context, "verification_id": str(uuid4())}
    checked = {**attempt, "submittedAt": now, "result": result}
    assert CourseAttemptPayload.model_validate(checked).result is not None
    with pytest.raises(ValidationError):
        CourseAttemptPayload.model_validate({**checked, "resultTrust": "server_verified"})
    with pytest.raises(ValidationError):
        CourseAttemptPayload.model_validate(
            {**checked, "result": {**result, "mastery_asserted": 0}}
        )
    with pytest.raises(ValidationError):
        CourseAttemptPayload.model_validate(
            {**checked, "result": {**result, "client_revision_id": str(uuid4())}}
        )
    with pytest.raises(ValidationError):
        CourseAttemptPayload.model_validate(
            {**attempt, "rows": [{**attempt["rows"][0], "implication": 1}, *attempt["rows"][1:]]}
        )
