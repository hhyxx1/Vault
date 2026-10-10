from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.code_execution import CodeRequest, request_hash
from vault_backend.sync_schemas import PAYLOAD_MODELS


def sample():
    now = datetime.now(UTC).isoformat()
    request = CodeRequest(language="python313", files={"main.py": "print(2+3)"}, entry="main.py")
    return {
        "id": str(uuid4()),
        "artifactId": str(uuid4()),
        "spaceId": str(uuid4()),
        "activityKey": "my-custom-course:addition",
        "request": request.model_dump(),
        "requestHash": request_hash(request),
        "result": None,
        "createdAt": now,
        "updatedAt": now,
    }


def test_code_attempt_import_binds_request_output_and_does_not_grant_mastery():
    assert "code_attempt" in PAYLOAD_MODELS
    model = PAYLOAD_MODELS["code_attempt"]
    payload = sample()
    assert model.model_validate(payload).result is None
    result = {
        "status": "success",
        "phase": "run",
        "stdout": "5\n",
        "stderr": "",
        "truncated": False,
        "metadata": {},
        "runtime_profile": "python313-isolate-dev@0.1.0",
        "request_sha256": payload["requestHash"],
        "mastery_asserted": False,
        "client_artifact_id": payload["artifactId"],
        "client_revision_id": payload["id"],
    }
    assert model.model_validate({**payload, "result": result}).result.stdout == "5\n"
    for mutation in (
        {"mastery_asserted": True},
        {"client_revision_id": str(uuid4())},
        {"request_sha256": "0" * 64},
    ):
        with pytest.raises(ValidationError):
            model.model_validate({**payload, "result": {**result, **mutation}})
    with pytest.raises(ValidationError):
        model.model_validate({**payload, "requestHash": "0" * 64})
    with pytest.raises(ValidationError):
        model.model_validate({**payload, "resultTrust": "server_verified"})
