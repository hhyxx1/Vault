import pytest
from pydantic import ValidationError

from vault_backend.sync_schemas import PAYLOAD_MODELS


def payload():
    return dict(
        id="a" * 64,
        spaceId="17e6f7bf-415b-4767-bf28-8d2fb67bc8c2",
        activityKey="custom-course:topic",
        request=dict(
            language="python313", files={"main.py": "print(1)"}, entry="main.py", stdin=""
        ),
        prediction="会输出 1",
        reflection="准备改变输入",
        learningContext=None,
        createdAt="2026-10-10T01:00:00Z",
        updatedAt="2026-10-10T01:00:00Z",
    )


def test_editable_code_draft_has_no_results_or_mastery_and_is_not_limited_to_default_courses():
    model = PAYLOAD_MODELS["code_draft"]
    assert model.model_validate(payload()).activityKey == "custom-course:topic"
    note_id = "17e6f7bf-415b-4767-bf28-8d2fb67bc8c2"
    assert (
        model.model_validate(payload() | {"reflections": {note_id: "first version"}}).reflections[
            note_id
        ]
        == "first version"
    )
    for change in (
        {"result": {}},
        {"prediction": "a" * 4001},
        {"mastery_asserted": True},
        {"reflections": {"invalid": "note"}},
        {"reflections": {note_id: "a" * 4001}},
    ):
        with pytest.raises(ValidationError):
            model.model_validate(payload() | change)
