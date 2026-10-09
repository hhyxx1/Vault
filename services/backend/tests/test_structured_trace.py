"""Tests for the generic structured-trace checker (CS03 stack/ring-queue units).

Expected snapshots for the worked activities are hard-coded here from the unit
plan (UNIT_EXAMPLE_CS03_STACK.md) rather than derived from the checker, so the
activity specification and the tests are independent evidence. Deliberately
wrong traces target the classic ways of gaming a checker: hard-coded output,
ignoring underflow/full, reporting only the final state, and missing wrap-around.
"""

from uuid import uuid4

import pytest

from vault_backend.course_checks.machines import RingQueueMachine, StackMachine, Operation
from vault_backend.course_checks.structured_trace import (
    TRUSTED_TRACE_SPECS,
    get_trace_spec,
    verify_structured_trace,
)

STACK = get_trace_spec("CS03-STACK-U01-TRACE@0.1.0")
QUEUE = get_trace_spec("CS03-QUEUE-U02-TRACE@0.1.0")


def _steps(spec):
    return [
        {
            "state": {name: snapshot[name] for name in spec.state_fields},
            "value": snapshot["value"],
            "status": snapshot["status"],
        }
        for snapshot in spec.expected()
    ]


def _submission(spec, steps, explanation="边界失败时状态保持不变，弹出顺序由操作端决定。"):
    return {
        "course_code": "CS03",
        "course_version": "CS03-learning-0.3.0",
        "client_artifact_id": uuid4(),
        "client_revision_id": uuid4(),
        "explanation": explanation,
        "steps": steps,
    }


def _criteria(result):
    return {item["id"]: item["status"] for item in result["criteria"]}


# --- Hard-coded expected trajectories (independent of the checker) ----------


def test_stack_u01_hardcoded_trajectory():
    rows = StackMachine(3).run(STACK.operations)
    expected = [
        ((), None, "underflow"),
        ((4,), None, "ok"),
        ((4, 7), None, "ok"),
        ((4,), 7, "ok"),
        ((4, 9), None, "ok"),
        ((4, 9, 2), None, "ok"),
        ((4, 9, 2), None, "full"),
    ]
    assert [(r.items, r.value, r.status) for r in rows] == expected


def test_queue_u02_hardcoded_trajectory():
    rows = RingQueueMachine(3).run(QUEUE.operations)
    expected = [
        ((None, None, None), 0, 0, 0, (), None, "underflow"),
        ((1, None, None), 0, 1, 1, (1,), None, "ok"),
        ((1, 2, None), 0, 2, 2, (1, 2), None, "ok"),
        ((1, 2, 3), 0, 0, 3, (1, 2, 3), None, "ok"),
        ((1, 2, 3), 0, 0, 3, (1, 2, 3), None, "full"),
        ((None, 2, 3), 1, 0, 2, (2, 3), 1, "ok"),
        ((4, 2, 3), 1, 1, 3, (2, 3, 4), None, "ok"),
        ((4, None, 3), 2, 1, 2, (3, 4), 2, "ok"),
        ((4, None, None), 0, 1, 1, (4,), 3, "ok"),
        ((None, None, None), 1, 1, 0, (), 4, "ok"),
        ((None, None, None), 1, 1, 0, (), None, "underflow"),
    ]
    actual = [
        (r.buffer, r.head, r.tail, r.size, r.logical, r.value, r.status) for r in rows
    ]
    assert actual == expected


# --- Correct work passes the deterministic conditions, never full mastery ---


def test_correct_stack_u01_passes_without_mastery_assertion():
    result = verify_structured_trace(_submission(STACK, _steps(STACK)), STACK)
    assert result["trace_correct"] is True
    assert result["mastery_asserted"] is False
    assert result["objective_state"] == "evidence_pending_review"
    criteria = _criteria(result)
    assert criteria["stack.order"] == "met"
    assert criteria["stack.bounds"] == "met"
    assert criteria["explanation"] == "needs_review"
    assert criteria["independent_transfer"] == "needs_review"


def test_correct_queue_u02_passes_without_mastery_assertion():
    result = verify_structured_trace(_submission(QUEUE, _steps(QUEUE)), QUEUE)
    assert result["trace_correct"] is True
    assert result["mastery_asserted"] is False
    criteria = _criteria(result)
    assert criteria["queue.fifo"] == "met"
    assert criteria["queue.wrap"] == "met"
    assert criteria["queue.bounds"] == "met"
    assert criteria["independent_transfer"] == "needs_review"


# --- Stack: ordering and boundary gaming attempts ---------------------------


@pytest.mark.parametrize(
    "step,mutate",
    [
        # pop returns the bottom instead of the top
        (3, lambda s: s.update(value=4)),
        # the full push is accepted and overflows the bounded stack
        (6, lambda s: s["state"].update(items=(4, 9, 2, 5))),
        (6, lambda s: s.update(status="ok")),
        # empty pop is not flagged as underflow
        (0, lambda s: s.update(status="ok")),
        # an intermediate state is wrong even though the final state matches
        (2, lambda s: s["state"].update(items=(7,))),
    ],
)
def test_stack_wrong_traces_are_rejected(step, mutate):
    steps = _steps(STACK)
    mutate(steps[step])
    result = verify_structured_trace(_submission(STACK, steps), STACK)
    assert result["trace_correct"] is False
    assert result["rows"][step]["correct"] is False
    assert result["objective_state"] == "practicing"


# --- Queue: FIFO, wrap-around and full/empty gaming attempts -----------------


@pytest.mark.parametrize(
    "step,mutate",
    [
        # LIFO confusion on dequeue
        (7, lambda s: s.update(value=3)),
        # wrap-around: tail is advanced without modulo so D lands in the wrong slot
        (6, lambda s: s["state"].update(buffer=(4, 2, None), tail=2)),
        # the full enqueue overwrites existing data instead of being rejected
        (4, lambda s: s["state"].update(buffer=(4, 2, 3), size=3)),
        (4, lambda s: s.update(status="ok")),
        # final empty dequeue is not flagged as underflow
        (10, lambda s: s.update(status="ok")),
        # head/tail forgotten: logical order alone cannot prove wrap-around
        (6, lambda s: s["state"].update(head=0)),
    ],
)
def test_queue_wrong_traces_are_rejected(step, mutate):
    steps = _steps(QUEUE)
    mutate(steps[step])
    result = verify_structured_trace(_submission(QUEUE, steps), QUEUE)
    assert result["trace_correct"] is False
    assert result["rows"][step]["correct"] is False
    assert result["objective_state"] == "practicing"


def test_queue_wrap_error_fails_wrap_criterion_not_just_row():
    steps = _steps(QUEUE)
    # Student keeps a linear tail pointer after wrap, so physical layout is wrong
    # even though the reported size and dequeued values happen to look plausible.
    steps[6]["state"].update(buffer=(None, 2, 4), tail=2)
    criteria = _criteria(verify_structured_trace(_submission(QUEUE, steps), QUEUE))
    assert criteria["queue.wrap"] == "not_met"


# --- Explanation, shape and registry guards ---------------------------------


def test_missing_explanation_is_not_met():
    result = verify_structured_trace(_submission(STACK, _steps(STACK), explanation="   "), STACK)
    assert _criteria(result)["explanation"] == "not_met"


def test_step_count_mismatch_raises():
    steps = _steps(STACK)[:-1]
    with pytest.raises(ValueError):
        verify_structured_trace(_submission(STACK, steps), STACK)


def test_unknown_activity_has_no_spec():
    with pytest.raises(KeyError):
        get_trace_spec("CS99-FAKE@9.9.9")


def test_registry_only_contains_trusted_versions():
    assert set(TRUSTED_TRACE_SPECS) == {
        "CS03-STACK-U01-TRACE@0.1.0",
        "CS03-QUEUE-U02-TRACE@0.1.0",
    }
