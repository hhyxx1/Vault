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


def _suite_payload(fixed_status="met"):
    model = PAYLOAD_MODELS["code_attempt"]
    request = CodeRequest(language="c17", files={"main.c": "int main(){return 0;}"}, entry="main.c")
    now = datetime.now(UTC).isoformat()
    payload = {
        "id": str(uuid4()),
        "artifactId": str(uuid4()),
        "spaceId": str(uuid4()),
        "activityKey": "7ca20169:semantic-suite",
        "request": request.model_dump(),
        "requestHash": request_hash(request),
        "createdAt": now,
        "updatedAt": now,
    }
    context = dict(
        courseId=str(uuid4()),
        courseVersionId="7ca20169-02d2-5719-b3f0-eff208ae89db",
        activityVersionId="256601b5-be28-5e49-8a78-d8f39b8f48b4",
        objectiveCode="CS01-M03-O03",
        taskCode="semantic-suite",
        helpViewed=[],
    )
    criteria = [
        {"id": "fixed_condition", "status": fixed_status, "reason": "多输入核验"},
        {"id": "explanation", "status": "needs_review", "reason": "待复核"},
        {"id": "independent_transfer", "status": "needs_review", "reason": "有限用例"},
    ]
    result = {
        "status": "success",
        "phase": "run",
        "stdout": "0\n",
        "stderr": "",
        "truncated": False,
        "metadata": {},
        "runtime_profile": "c17-isolate-dev@0.1.0",
        "request_sha256": payload["requestHash"],
        "mastery_asserted": False,
        "client_artifact_id": payload["artifactId"],
        "client_revision_id": payload["id"],
        "suite_assessment": {
            "course_version_id": context["courseVersionId"],
            "activity_version_id": context["activityVersionId"],
            "objective_code": context["objectiveCode"],
            "standard_version": "code-semantic-suite-v1",
            "provenance": "server_deterministic_checker",
            "comparator": "integer",
            "oracle_id": "parking_fee_three_tier",
            "scope_note": "有限受控输入，不证明一般正确。",
            "suspected_hardcoding": False,
            "cases": [
                {
                    "case_code": "visible-30",
                    "kind": "visible",
                    "stdin": "30\n",
                    "expected_stdout": "0\n",
                    "observed_status": "success",
                    "observed_stdout": "0\n",
                    "status": fixed_status,
                    "reason": "语义一致",
                }
            ],
            "criteria": criteria,
            "mastery_asserted": False,
        },
    }
    payload["learning"] = dict(context=context, prediction="边界含等号")
    payload["result"] = result
    return model, payload


def test_imported_semantic_suite_binds_context_and_never_grants_mastery():
    model, payload = _suite_payload()
    validated = model.model_validate(payload)
    assert validated.result.suite_assessment.standard_version == "code-semantic-suite-v1"
    assert validated.result.task_assessment is None

    def expect_reject(mutate):
        clone = _suite_payload()[1]
        mutate(clone)
        with pytest.raises(ValidationError):
            model.model_validate(clone)

    # Bound to the frozen course/activity/objective and the suite marker.
    expect_reject(lambda p: p["learning"]["context"].update(activityVersionId=str(uuid4())))
    expect_reject(lambda p: p["learning"]["context"].update(objectiveCode="CS01-M99-O99"))
    expect_reject(lambda p: p["learning"]["context"].update(taskCode="base"))
    expect_reject(lambda p: p["learning"].__setitem__("context", None))
    # No independent mastery, no trusted-provenance/standard tampering.
    expect_reject(lambda p: p["result"]["suite_assessment"]["criteria"].__setitem__(1, {**p["result"]["suite_assessment"]["criteria"][1], "status": "met"}))
    expect_reject(lambda p: p["result"]["suite_assessment"].update(mastery_asserted=True))
    expect_reject(lambda p: p["result"]["suite_assessment"].update(provenance="client_reported"))
    expect_reject(lambda p: p["result"]["suite_assessment"].update(standard_version="code-fixed-condition-v1"))
    # A result cannot carry both the fixed and the suite assessment.
    expect_reject(
        lambda p: p["result"].update(
            task_assessment=p["result"]["suite_assessment"]
            | {"task_code": "base", "standard_version": "code-fixed-condition-v1"}
        )
    )
