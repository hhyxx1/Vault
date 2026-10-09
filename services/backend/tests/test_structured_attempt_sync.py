from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.sync_schemas import PAYLOAD_MODELS


def draft():
    now = datetime.now(UTC).isoformat()
    return dict(
        id=str(uuid4()),
        spaceId=str(uuid4()),
        artifactId=str(uuid4()),
        objectiveCode="CS03-STACK-01",
        courseCode="CS03",
        activityVersion="CS03-STACK-U01-TRACE@0.1.0",
        kind="structured_trace",
        traceRows=[dict(state={"items": ""}, value="", status="") for _ in range(7)],
        bracketRows=[],
        explanation="",
        result=None,
        createdAt=now,
        updatedAt=now,
    )


def test_structured_sync_accepts_editable_draft_but_rejects_wrong_binding():
    model = PAYLOAD_MODELS["structured_attempt"]
    record = draft()
    assert model.model_validate(record).result is None
    for patch in (
        {"activityVersion": "unregistered"},
        {"objectiveCode": "CS03-QUEUE-01"},
        {"kind": "bracket_judgement"},
        {"traceRows": []},
        {"resultTrust": "server_verified"},
    ):
        with pytest.raises(ValidationError):
            model.model_validate({**record, **patch})
