from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError
from test_algebra_registry import registry_work as registry_work

from vault_backend import content
from vault_backend.sync_schemas import PAYLOAD_MODELS


@pytest.fixture
def payload(registry_work, monkeypatch):
    registry, work, package, activity = registry_work
    monkeypatch.setattr(
        content,
        "CourseRepository",
        lambda _: SimpleNamespace(
            packages={(package["course_id"], package["course_version_id"]): package}
        ),
    )
    stamp = datetime.now(UTC).isoformat()
    result = registry.verify(work) | {"verification_id": str(uuid4())}
    return {
        "id": str(work.client_revision_id),
        "artifactId": str(work.client_artifact_id),
        "spaceId": str(uuid4()),
        "courseCode": "CS05",
        "objectiveCode": work.objective_code,
        "courseVersionId": str(work.course_version_id),
        "activityVersionId": str(work.activity_version_id),
        "activityVersion": activity["version"],
        "mode": work.mode,
        "table": [[str(x) for x in row] for row in work.table],
        "secondTable": None,
        "mapping": None,
        "predictions": {"closed": "false", "associative": "unchecked", "is_group": "false"},
        "explanation": work.explanation,
        "result": result,
        "createdAt": stamp,
        "updatedAt": stamp,
        "submittedAt": stamp,
    }


def test_native_sync_accepts_bound_historical_result_without_importing_trust(payload):
    model = PAYLOAD_MODELS["algebra_attempt"]
    assert model.model_validate(payload).result.mastery_asserted is False
    draft = {
        **payload,
        "result": None,
        "submittedAt": None,
        "predictions": {"closed": "", "associative": "", "is_group": ""},
    }
    assert model.model_validate(draft).result is None
    with pytest.raises(ValidationError):
        model.model_validate({**payload, "resultTrust": "server_verified"})


@pytest.mark.parametrize(
    "field,value",
    [
        ("client_revision_id", str(uuid4())),
        ("course_version_id", str(uuid4())),
        ("artifact_hash", "0" * 64),
        ("mastery_asserted", True),
        ("report", {"is_group": True}),
        ("prediction_correct", False),
    ],
)
def test_native_import_rejects_identity_or_computation_tampering(payload, field, value):
    with pytest.raises(ValidationError):
        PAYLOAD_MODELS["algebra_attempt"].model_validate(
            {**payload, "result": {**payload["result"], field: value}}
        )


def test_native_import_cannot_change_the_submitted_table_or_drop_submission_timestamp(payload):
    model = PAYLOAD_MODELS["algebra_attempt"]
    for mutation in [
        {"table": [["0", "1"], ["1", "0"]]},
        {"submittedAt": None},
        {"objectiveCode": "CS05-M01-O01"},
    ]:
        with pytest.raises(ValidationError):
            model.model_validate({**payload, **mutation})
