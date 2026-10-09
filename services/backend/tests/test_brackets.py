"""Tests for the deterministic bracket-judgement checker (CS03 unit U04).

Expected verdicts and first-offender indices are hard-coded here from the unit
plan rather than derived from the checker, so the implementation and the tests
are independent evidence. The fixed set covers the empty string, nesting,
adjacent pairs, a crossing mismatch, a leading closing bracket, and a dangling
opening bracket.
"""

from uuid import uuid4

import pytest

from vault_backend.course_checks.brackets import (
    BRACKET_CASES,
    brackets_match,
    diagnose_brackets,
    expected_judgements,
    verify_bracket_judgements,
)


# --- Hard-coded verdicts (independent of the checker implementation) ---------


@pytest.mark.parametrize(
    "text,matched,index,kind",
    [
        ("", True, None, None),
        ("([{}])", True, None, None),
        ("()[]{}", True, None, None),
        ("([)]", False, 2, "closing_mismatch"),
        (")(", False, 0, "closing_mismatch"),
        ("(()", False, 0, "unclosed_opening"),
        # extra boundary probes
        ("((()))", True, None, None),
        ("{[]}", True, None, None),
        ("{[}]", False, 2, "closing_mismatch"),
        ("([{}", False, 0, "unclosed_opening"),
        ("{}[", False, 2, "unclosed_opening"),
    ],
)
def test_diagnose_brackets_hardcoded(text, matched, index, kind):
    diagnosis = diagnose_brackets(text)
    assert (diagnosis.matched, diagnosis.index, diagnosis.kind) == (
        matched,
        index,
        kind,
    )
    assert brackets_match(text) is matched


def test_fixed_case_set_is_the_unit_plan_set():
    assert BRACKET_CASES == ("", "([{}])", "()[]{}", "([)]", ")(", "(()")


def test_rejects_alphabet_outside_the_activity_contract():
    with pytest.raises(ValueError):
        diagnose_brackets("(a)")


# --- Correct judgements pass without claiming mastery ------------------------


def _correct_submission(explanation="闭括号应匹配最近的同种左括号；空串天然匹配。"):
    judgements = [
        {"case": "", "matched": True, "mismatch_index": None},
        {"case": "([{}])", "matched": True, "mismatch_index": None},
        {"case": "()[]{}", "matched": True, "mismatch_index": None},
        {"case": "([)]", "matched": False, "mismatch_index": 2},
        {"case": ")(", "matched": False, "mismatch_index": 0},
        {"case": "(()", "matched": False, "mismatch_index": 0},
    ]
    return {
        "course_code": "CS03",
        "client_artifact_id": uuid4(),
        "client_revision_id": uuid4(),
        "explanation": explanation,
        "judgements": judgements,
    }


def _criteria(result):
    return {item["id"]: item["status"] for item in result["criteria"]}


def test_correct_judgements_pass_without_mastery_assertion():
    result = verify_bracket_judgements(_correct_submission())
    assert result["bracket_correct"] is True
    assert result["mastery_asserted"] is False
    assert result["objective_state"] == "evidence_pending_review"
    criteria = _criteria(result)
    assert criteria["brackets.nesting"] == "met"
    assert criteria["brackets.diagnose"] == "met"
    assert criteria["explanation"] == "needs_review"
    assert criteria["independent_transfer"] == "needs_review"


def test_server_answer_key_matches_hardcoded_expectations():
    assert [(row["matched"], row["mismatch_index"]) for row in expected_judgements()] == [
        (True, None),
        (True, None),
        (True, None),
        (False, 2),
        (False, 0),
        (False, 0),
    ]


# --- Wrong verdicts and locations are rejected -------------------------------


def test_wrong_balance_verdict_fails_nesting():
    submission = _correct_submission()
    submission["judgements"][3]["matched"] = True  # "([)]" wrongly accepted
    result = verify_bracket_judgements(submission)
    assert result["bracket_correct"] is False
    assert _criteria(result)["brackets.nesting"] == "not_met"
    assert result["rows"][3]["correct"] is False


def test_wrong_offender_index_fails_diagnose_but_not_nesting():
    submission = _correct_submission()
    submission["judgements"][4]["mismatch_index"] = 1  # ")(" first offender is 0
    result = verify_bracket_judgements(submission)
    criteria = _criteria(result)
    assert criteria["brackets.diagnose"] == "not_met"
    # The balance verdict itself was still right.
    assert criteria["brackets.nesting"] == "met"


def test_missing_explanation_is_not_met():
    result = verify_bracket_judgements(_correct_submission(explanation="  "))
    assert _criteria(result)["explanation"] == "not_met"


def test_case_set_mismatch_raises():
    submission = _correct_submission()
    submission["judgements"].pop()
    with pytest.raises(ValueError):
        verify_bracket_judgements(submission)


def test_reordered_cases_raise():
    submission = _correct_submission()
    submission["judgements"][0], submission["judgements"][1] = (
        submission["judgements"][1],
        submission["judgements"][0],
    )
    with pytest.raises(ValueError):
        verify_bracket_judgements(submission)
