from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.course_packages import Activity


def activity(**changes):
    value = dict(
        id=str(uuid4()),
        version_id=str(uuid4()),
        code="CUSTOM-RUN",
        version="1",
        objective_codes=["CUSTOM-O1"],
        kind="code",
        student_action="修改后重新运行",
        theory=["输出来自本次提交"],
        starter="",
        source_refs=["official"],
        availability="practice_ready",
        completion_limit="运行不是掌握判断",
        code_request=dict(
            language="c17", files={"main.c": "int main(void){return 0;}"}, entry="main.c", stdin=""
        ),
    )
    value.update(changes)
    return value


def test_ready_code_activity_carries_a_valid_reusable_execution_request():
    result = Activity.model_validate(activity())
    assert result.code_request.language == "c17"
    assert result.code_request.entry == "main.c"


@pytest.mark.parametrize(
    "changes",
    [
        {"code_request": None},
        {"code_request": {"language": "c17", "files": {"../main.c": ""}, "entry": "../main.c"}},
        {"kind": "network"},
    ],
)
def test_activity_cannot_publish_missing_unsafe_or_wrong_kind_execution(changes):
    with pytest.raises(ValidationError):
        Activity.model_validate(activity(**changes))
