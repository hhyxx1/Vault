from copy import deepcopy

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from vault_backend.checker import canonical_hash, verify_trace
from vault_backend.schemas import TraceSubmission


def test_correct_trace_is_not_full_mastery(submission):
    result = verify_trace(submission)
    assert result["trace_correct"] is True
    assert result["mastery_asserted"] is False
    assert result["objective_state"] == "evidence_pending_review"
    criteria = {item["id"]: item["status"] for item in result["criteria"]}
    assert criteria["explanation"] == "needs_review"
    assert criteria["independent_transfer"] == "needs_review"
    assert result["client_revision_id"] == str(submission.client_revision_id)


@pytest.mark.parametrize(
    "row,field,value",
    [
        (1, "after_stack", [3, 8]),
        (2, "output", 8),
        (6, "underflow", False),
        (6, "output", 0),
        (0, "after_stack", []),
    ],
)
def test_wrong_order_output_and_underflow(trace_payload, row, field, value):
    trace_payload["trace"][row][field] = value
    result = verify_trace(TraceSubmission.model_validate(trace_payload))
    assert result["trace_correct"] is False
    assert result["rows"][row]["correct"] is False
    assert result["objective_state"] == "practicing"


def test_explanation_missing_is_not_met(trace_payload):
    trace_payload["explanation"] = "  "
    result = verify_trace(TraceSubmission.model_validate(trace_payload))
    assert (
        next(item for item in result["criteria"] if item["id"] == "explanation")["status"]
        == "not_met"
    )


@given(st.integers(min_value=-1_000_000, max_value=1_000_000).filter(lambda v: v != 3))
def test_any_wrong_first_pop_output_is_rejected(value):
    from uuid import uuid4

    payload = {
        "activity_version": "CS03-STACK-01-TRACE@0.1.0",
        "standard_version": "stack-trace-v1",
        "client_artifact_id": uuid4(),
        "client_revision_id": uuid4(),
        "trace": [
            {"after_stack": [8], "output": None, "underflow": False},
            {"after_stack": [8, 3], "output": None, "underflow": False},
            {"after_stack": [8], "output": value, "underflow": False},
            {"after_stack": [8, 5], "output": None, "underflow": False},
            {"after_stack": [8], "output": 5, "underflow": False},
            {"after_stack": [], "output": 8, "underflow": False},
            {"after_stack": [], "output": None, "underflow": True},
        ],
    }
    assert verify_trace(TraceSubmission.model_validate(payload))["trace_correct"] is False


def test_hash_order_independent_and_work_sensitive(trace_payload):
    assert canonical_hash(trace_payload) == canonical_hash(
        dict(reversed(list(trace_payload.items())))
    )
    changed = deepcopy(trace_payload)
    changed["explanation"] += "修改"
    assert canonical_hash(trace_payload) != canonical_hash(changed)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update(owner_account_id="arbitrary"),
        lambda p: p["trace"][0].update(after_stack=[True]),
        lambda p: p["trace"][0].update(output=1.2),
        lambda p: p["trace"].pop(),
        lambda p: p.update(activity_version="unreviewed"),
    ],
)
def test_untrusted_fields_and_shape_rejected(trace_payload, mutate):
    mutate(trace_payload)
    with pytest.raises(ValidationError):
        TraceSubmission.model_validate(trace_payload)
