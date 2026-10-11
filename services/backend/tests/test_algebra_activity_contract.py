from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.course_packages import Activity


def activity(**changes):
    return {
        "id": str(uuid4()),
        "version_id": str(uuid4()),
        "code": "CS05-M07-O01-TABLE",
        "version": "0.1.0",
        "objective_codes": ["CS05-M07-O01"],
        "kind": "finite_algebra",
        "student_action": "填写完整表，预测性质后核验。",
        "theory": ["封闭要求每个有序对的结果属于给定集合。"],
        "starter": "修改表中一项，并解释影响。",
        "source_refs": ["milne-group"],
        "availability": "practice_ready",
        "completion_limit": "仅证明给定完整有限表的性质，不确认一般证明和长期掌握。",
        "algebra_prompt": {
            "mode": "group",
            "table": [[0, 1], [1, 2]],
            "second_table": None,
            "mapping": None,
        },
        **changes,
    }


def test_native_public_activity_has_bounded_table_prompt_and_no_uploaded_checker():
    parsed = Activity.model_validate(activity())
    assert parsed.algebra_prompt.mode == "group"
    assert parsed.algebra_prompt.table[1][1] == 2


@pytest.mark.parametrize(
    "changes",
    [
        {"algebra_prompt": None},
        {"kind": "open_response"},
        {"algebra_prompt": {"mode": "group", "table": [[True]]}},
        {"algebra_prompt": {"mode": "group", "table": [[0]], "expected": {"is_group": True}}},
        {"algebra_prompt": {"mode": "ring", "table": [[0]], "second_table": [[0, 1], [1, 0]]}},
        {
            "algebra_prompt": {
                "mode": "homomorphism",
                "table": [[0]],
                "second_table": [[0]],
                "mapping": [1],
            }
        },
    ],
)
def test_native_contract_rejects_wrong_kind_incomplete_work_or_private_results(changes):
    with pytest.raises(ValidationError):
        Activity.model_validate(activity(**changes))
