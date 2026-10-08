"""Unit tests for account-sync payload contracts that do not require PostgreSQL."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from vault_backend.sync_schemas import PAYLOAD_MODELS


def scope_version_payload():
    course_id, topic_id = uuid4(), uuid4()
    return {
        "id": str(uuid4()),
        "spaceId": str(uuid4()),
        "courseId": str(course_id),
        "version": 1,
        "title": "计算机网络",
        "goal": "解释路由决策并完成可复现验证",
        "topics": [
            {
                "id": str(topic_id),
                "title": "路由选择",
                "expectedPerformance": "构造路由表并解释转发结果",
            }
        ],
        "scopeStatus": "defined",
        "gaps": [],
        "confirmedAt": "2026-10-07T12:00:00Z",
    }


def test_personal_course_scope_version_is_a_bounded_explicit_sync_contract():
    model = PAYLOAD_MODELS["personal_course_version"].model_validate(scope_version_payload())
    assert model.version == 1
    assert model.scopeStatus == "defined"
    assert model.topics[0].title == "路由选择"


def test_personal_course_scope_version_cannot_claim_defined_without_goal_and_topics():
    payload = scope_version_payload()
    payload.update(goal="", topics=[], scopeStatus="defined", gaps=["goal", "learning_points"])
    with pytest.raises(ValidationError):
        PAYLOAD_MODELS["personal_course_version"].model_validate(payload)
