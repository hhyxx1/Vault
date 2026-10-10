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


def test_imported_task_feedback_matches_frozen_context_and_never_verifies_explanation():
    from vault_backend.code_execution import CodeResult
    from vault_backend.course_checks.code_tasks import assess_task, resolve_task

    model = PAYLOAD_MODELS["code_attempt"]
    payload = sample()
    task = resolve_task("ad970167-0230-5141-8027-cc535f3ed22e", "CS01-M01-O02", "base")
    context = dict(
        courseId=str(uuid4()),
        courseVersionId=task.course_version_id,
        activityVersionId="07fe337c-cafd-550c-ac1c-4ac964b005f6",
        objectiveCode=task.objective_code,
        taskCode="base",
        helpViewed=[],
    )
    request = CodeRequest.model_validate(payload["request"])
    result = CodeResult(
        status="success",
        phase="run",
        stdout="5\n",
        runtime_profile="test",
        request_sha256=payload["requestHash"],
    )
    feedback = assess_task(task, request, result)
    payload["learning"] = dict(context=context, prediction="5")
    payload["result"] = result.model_dump() | dict(
        client_revision_id=payload["id"],
        client_artifact_id=payload["artifactId"],
        task_assessment=feedback,
    )
    assert model.model_validate(payload).result.task_assessment.criteria[0].status == "met"
    with pytest.raises(ValidationError):
        model.model_validate(payload | {"learning": None})
    feedback["criteria"][1]["status"] = "met"
    with pytest.raises(ValidationError):
        model.model_validate(payload)
