from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.course_checks.algebra_submission import AlgebraWork, check_algebra_work


def work(**changes):
    return AlgebraWork.model_validate(
        {
            "mode": "group",
            "table": [[0, 1, 2], [1, 0, 0], [2, 0, 0]],
            "predictions": {"closed": True, "associative": False, "is_group": False},
            "explanation": "单位元和逆元不保证结合律。",
            "client_artifact_id": str(uuid4()),
            "client_revision_id": str(uuid4()),
            **changes,
        }
    )


def test_correct_negative_classification_is_successful_evidence_not_failed_experiment():
    result = check_algebra_work(work())
    assert result["prediction_correct"]
    assert result["report"]["associativity_witness"] == [1, 1, 2, 2, 1]
    assert result["mastery_asserted"] is False
    assert result["criteria"][-2]["status"] == "needs_review"
    assert result["criteria"][-1]["status"] == "needs_review"


def test_predicted_axiom_is_compared_to_actual_table_not_trusted():
    result = check_algebra_work(
        work(predictions={"closed": True, "associative": True, "is_group": True})
    )
    assert not result["prediction_correct"]
    assert [row["status"] for row in result["criteria"][:3]] == ["met", "not_met", "not_met"]


def test_changing_explanation_or_cell_changes_immutable_work_hash():
    original = work()
    first = check_algebra_work(original)
    assert (
        first["artifact_hash"]
        != check_algebra_work(original.model_copy(update={"explanation": "改写"}))["artifact_hash"]
    )
    changed = original.model_dump()
    changed["table"][1][1] = 1
    assert (
        first["artifact_hash"]
        != check_algebra_work(AlgebraWork.model_validate(changed))["artifact_hash"]
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"table": [[True]]},
        {"table": [[0, 1]]},
        {"predictions": {"closed": "true", "associative": False, "is_group": False}},
        {"predictions": {"is_group": False}},
        {"predictions": {"closed": True, "associative": False, "is_group": False, "mastery": True}},
        {"mode": "ring"},
        {"mode": "homomorphism"},
        {"checker_version": "attacker"},
        {"report": {"is_group": True}},
    ],
)
def test_incomplete_or_forged_work_is_rejected(changes):
    with pytest.raises(ValidationError):
        work(**changes)


def test_unchecked_axiom_after_failed_closure_is_never_graded_as_false():
    result = check_algebra_work(
        work(
            table=[[0, 1], [1, 2]],
            predictions={"closed": False, "associative": False, "is_group": False},
        )
    )
    assert result["report"]["associative"] is None
    assert result["criteria"][1]["status"] == "needs_review"
    assert not result["prediction_correct"]


def test_ring_work_distinguishes_ring_from_field():
    n = 6
    result = check_algebra_work(
        work(
            mode="ring",
            table=[[(a + b) % n for b in range(n)] for a in range(n)],
            second_table=[[(a * b) % n for b in range(n)] for a in range(n)],
            predictions={"ring": True, "unital_ring": True, "field": False},
        )
    )
    assert result["prediction_correct"]
    assert result["report"]["zero_divisor_witness"] == [2, 3]


def test_native_mapping_work_checks_noninjective_homomorphism():
    result = check_algebra_work(
        work(
            mode="homomorphism",
            table=[[(a + b) % 4 for b in range(4)] for a in range(4)],
            second_table=[[0, 1], [1, 0]],
            mapping=[0, 1, 0, 1],
            predictions={
                "preserves_operation": True,
                "injective": False,
                "surjective": True,
                "is_group_isomorphism": False,
            },
        )
    )
    assert result["prediction_correct"]
    assert result["report"]["is_group_homomorphism"]


def test_native_work_checks_budget_and_requires_shared_ring_domain():
    with pytest.raises(ValidationError):
        work(table=[[0] * 13 for _ in range(13)])
    with pytest.raises(ValidationError):
        work(
            mode="ring",
            second_table=[[0]],
            predictions={"ring": False, "unital_ring": False, "field": False},
        )
