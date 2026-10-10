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


def test_code_activity_carries_explicit_help_and_changed_conditions():
    value = activity()
    value.update(
        title="从错误开始",
        hints=["检查语句末尾"],
        prediction_prompt="预测失败阶段",
        reflection_prompt="解释差异",
        reference_answer=value["code_request"],
        variants=[
            {
                "code": "different-output",
                "title": "改变输出任务",
                "student_action": "修改文字再运行",
                "code_request": value["code_request"],
                "prediction_prompt": "预测输出",
                "reflection_prompt": "解释为何退出正常不等于答案正确",
            }
        ],
    )
    parsed = Activity.model_validate(value)
    assert parsed.variants[0].code == "different-output"
    with pytest.raises(ValidationError):
        Activity.model_validate({**value, "variants": value["variants"] * 2})


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
