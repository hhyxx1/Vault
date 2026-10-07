import json
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from vault_backend.agent_gateway import DeepSeekResponsesGateway, ModelRouter, OpenAIChatGateway
from vault_backend.api import create_app
from vault_backend.config import Settings
from vault_backend.errors import ApiError
from vault_backend.learning_assist import LearningAssistWorkflow
from vault_backend.learning_assist_schemas import LearningAssistReply, LearningAssistRequest
from vault_backend.model_profiles import ModelProfile
from vault_backend.sync_schemas import HelpPayload

ORIGIN = "http://localhost:5173"


class FakeAssist:
    def __init__(self):
        self.calls = []

    async def run(self, request, verification=None):
        self.calls.append((request, verification))
        return LearningAssistReply(
            message="回看空栈时的输出约定。", next_action="自己写出边界条件后再核验。"
        )


def assist_payload(**changes):
    payload = {
        "request_id": str(uuid4()),
        "course_code": "CS03",
        "course_version": "CS03-example-0.1.0",
        "activity_version": "CS03-STACK-01-TRACE@0.1.0",
        "objective_code": "CS03-STACK-01",
        "intent": "hint",
        "disclosure_accepted": True,
        "artifact_id": str(uuid4()),
        "revision_id": str(uuid4()),
        "goal": "解释栈的后进先出行为。",
        "question": "空栈出栈时为什么没有输出？",
        "work_excerpt": "[]",
        "explanation": "",
    }
    return {**payload, **changes}


async def make_client(settings, store, cap=6):
    settings.agent_enabled = True
    settings.deepseek_api_key = SecretStr("test-only-not-used")
    settings.guest_max_agent_requests = cap
    fake = FakeAssist()
    app = create_app(settings, store, fake)
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN)
    nonce = await client.get("/api/v1/guest-nonce")
    lease_response = await client.post(
        "/api/v1/guest-leases",
        headers={"Origin": ORIGIN},
        json={"nonce": nonce.json()["nonce"]},
    )
    assert lease_response.status_code == 201
    lease = lease_response.json()
    headers = {"Origin": ORIGIN, "Authorization": f"GuestLease {lease['token']}"}
    return client, fake, lease, headers


async def test_learning_assist_is_explicit_idempotent_and_bounded(settings, store):
    client, fake, lease, headers = await make_client(settings, store, cap=1)
    try:
        path = f"/api/v1/guest-leases/{lease['lease_id']}/learning-assist"
        payload = assist_payload()
        first = await client.post(path, headers=headers, json=payload)
        replay = await client.post(path, headers=headers, json=payload)
        assert first.status_code == replay.status_code == 200
        assert first.json()["mastery_asserted"] is False
        assert replay.json() == first.json()
        assert len(fake.calls) == 1
        conflict = await client.post(
            path, headers=headers, json=assist_payload(request_id=payload["request_id"])
        )
        assert conflict.status_code == 409
        exhausted = await client.post(path, headers=headers, json=assist_payload())
        assert exhausted.status_code == 429
    finally:
        await client.aclose()


async def test_result_feedback_uses_server_result_and_exact_revision(
    settings, store, trace_payload
):
    client, fake, lease, headers = await make_client(settings, store)
    try:
        op = await client.post(
            f"/api/v1/guest-leases/{lease['lease_id']}/operations",
            headers={**headers, "Idempotency-Key": str(uuid4())},
            json=trace_payload,
        )
        operation = op.json()
        result = operation["result"]
        path = f"/api/v1/guest-leases/{lease['lease_id']}/learning-assist"
        body = assist_payload(
            intent="result_feedback",
            operation_id=operation["operation_id"],
            artifact_id=result["client_artifact_id"],
            revision_id=result["client_revision_id"],
        )
        accepted = await client.post(path, headers=headers, json=body)
        assert accepted.status_code == 200
        assert fake.calls[0][1]["provenance"] == "server_deterministic_checker"
        assert fake.calls[0][1]["trace_correct"] is True
        assert fake.calls[0][1]["mastery_asserted"] is False
        mismatch = await client.post(
            path,
            headers=headers,
            json=assist_payload(intent="result_feedback", operation_id=operation["operation_id"]),
        )
        assert mismatch.status_code == 409
        assert len(fake.calls) == 1
    finally:
        await client.aclose()


def test_agent_is_disabled_by_default_and_requires_a_secret():
    assert Settings(environment="test").agent_enabled is False
    with pytest.raises(ValidationError, match="at least one configured model"):
        Settings(environment="test", agent_enabled=True)
    with pytest.raises(ValidationError, match="at least one configured model"):
        Settings(environment="test", agent_enabled=True, deepseek_api_key="   ")


def test_agent_request_requires_explicit_disclosure():
    with pytest.raises(ValidationError):
        LearningAssistRequest.model_validate(assist_payload(disclosure_accepted=False))
    with pytest.raises(ValidationError):
        LearningAssistRequest.model_validate(
            {key: value for key, value in assist_payload().items() if key != "disclosure_accepted"}
        )


async def test_deepseek_gateway_sends_schema_and_ignores_reasoning_text():
    seen = {}

    async def respond(request):
        seen["authorization"] = request.headers["Authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "reasoning",
                        "summary": [{"type": "summary_text", "text": "private reasoning"}],
                    },
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(
                                    {
                                        "message": "继续核对栈顶。",
                                        "next_action": "修改后重试。",
                                        "mastery_asserted": False,
                                    },
                                    ensure_ascii=False,
                                ),
                            }
                        ],
                    },
                ],
            },
        )

    gateway = DeepSeekResponsesGateway(
        "secret-test-key", "deepseek-flash", 5, 1, httpx.MockTransport(respond)
    )
    try:
        reply = await gateway.complete("Use JSON.", {"student_question": "Why?"})
        assert reply.mastery_asserted is False
        assert "private reasoning" not in reply.model_dump_json()
        assert seen["authorization"] == "Bearer secret-test-key"
        assert seen["body"]["text"]["format"]["type"] == "json_schema"
        assert "tools" not in seen["body"]
    finally:
        await gateway.close()


async def test_custom_chat_profile_routes_by_task_and_validates_output():
    seen = []

    def respond(request):
        seen.append((str(request.url), json.loads(request.content)))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "message": "检查下一步。",
                                    "next_action": "重新提交作品。",
                                    "mastery_asserted": False,
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    profile = ModelProfile(
        id="local_tutor",
        label="本地辅导模型",
        provider="本地",
        protocol="openai_chat",
        base_url="http://127.0.0.1:11434/v1/",
        model="my-tutor-model",
        capabilities={"text"},
    )
    gateway = OpenAIChatGateway(profile, None, 5, 1, httpx.MockTransport(respond))
    router = ModelRouter({"local_tutor": gateway}, [profile], {"hint": "local_tutor"})
    try:
        result = await router.complete("system rules", {"intent": "hint", "question": "why"})
        assert result.mastery_asserted is False
        assert seen[0][0] == "http://127.0.0.1:11434/v1/chat/completions"
        assert seen[0][1]["model"] == "my-tutor-model"
        assert "tools" not in seen[0][1]
        assert router.select("hint") is gateway
        assert router.select("practice", "local_tutor") is gateway
        with pytest.raises(ApiError) as error:
            router.select("hint", "unknown")
        assert error.value.code == "MODEL_PROFILE_UNAVAILABLE"
    finally:
        await router.close()


def test_model_profile_rejects_remote_plain_http_and_duplicate_ids():
    with pytest.raises(ValidationError):
        ModelProfile(
            id="bad",
            label="Bad",
            provider="Bad",
            protocol="openai_chat",
            base_url="http://remote.example/v1/",
            model="model",
            capabilities={"text"},
        )
    profile = {
        "id": "local",
        "label": "Local",
        "provider": "Local",
        "protocol": "openai_chat",
        "base_url": "http://127.0.0.1:11434/v1/",
        "model": "test",
        "capabilities": ["text"],
    }
    with pytest.raises(ValidationError, match="unique"):
        Settings(environment="test", model_profiles=[profile, profile])


def test_self_hosted_profile_can_be_loaded_from_environment(monkeypatch):
    monkeypatch.setenv(
        "VAULT_MODEL_PROFILES",
        json.dumps(
            [
                {
                    "id": "local",
                    "label": "Local",
                    "provider": "Self-hosted",
                    "protocol": "openai_chat",
                    "base_url": "http://127.0.0.1:11434/v1/",
                    "model": "installed-model",
                    "capabilities": ["text"],
                }
            ]
        ),
    )
    monkeypatch.setenv("VAULT_MODEL_TASK_DEFAULTS", '{"hint":"local"}')
    settings = Settings(environment="test", agent_enabled=True)
    assert settings.model_profiles[0].id == "local"
    assert settings.model_task_defaults["hint"] == "local"


async def test_public_profile_listing_omits_endpoint_and_credential_name():
    settings = Settings(
        environment="test",
        agent_enabled=True,
        model_profiles=[
            {
                "id": "local",
                "label": "我的本地模型",
                "provider": "本地",
                "protocol": "openai_chat",
                "base_url": "http://127.0.0.1:11434/v1/",
                "model": "private-model",
                "capabilities": ["text", "reasoning"],
            }
        ],
        model_task_defaults={"hint": "local"},
    )
    app = create_app(settings)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN) as client:
        response = await client.get("/api/v1/model-profiles")
    assert response.status_code == 200
    assert response.json()["profiles"] == [
        {
            "id": "local",
            "label": "我的本地模型",
            "provider": "本地",
            "capabilities": ["reasoning", "text"],
        }
    ]
    assert response.json()["task_defaults"]["hint"] == "local"
    assert "private-model" not in response.text
    assert "11434" not in response.text
    await app.state.agent.close()


async def test_langgraph_routes_roles_without_live_provider_calls():
    pytest.importorskip("langgraph.graph")

    class FakeGateway:
        def __init__(self):
            self.instructions = []

        async def complete(self, instructions, context):
            self.instructions.append(instructions)
            return LearningAssistReply(message="继续尝试。", next_action="再提交一次作品。")

        async def close(self):
            return None

    gateway = FakeGateway()
    workflow = LearningAssistWorkflow(gateway)
    cases = {
        "diagnose": "学习诊断助手",
        "hint": "辅导助手",
        "practice": "练习设计助手",
        "result_feedback": "核验结果解释助手",
    }
    for intent, expected in cases.items():
        payload = assist_payload(intent=intent)
        if intent == "result_feedback":
            payload["operation_id"] = str(uuid4())
        reply = await workflow.run(LearningAssistRequest.model_validate(payload), {})
        assert reply.mastery_asserted is False
        assert expected in gateway.instructions[-1]
    await workflow.close()


def test_agent_assist_sync_event_requires_revision_and_preserves_context():
    from datetime import UTC, datetime

    event = {
        "id": str(uuid4()),
        "spaceId": str(uuid4()),
        "objectiveId": "CS03-STACK-01",
        "kind": "agent_assist",
        "disclosureVersion": "learning-assist-deepseek-v1",
        "createdAt": datetime.now(UTC).isoformat(),
        "intent": "hint",
        "question": "为什么这里下溢？",
        "reply": "请检查空栈条件。",
        "nextAction": "补充边界推演。",
        "revisionId": str(uuid4()),
        "artifactId": str(uuid4()),
        "courseVersion": "CS03-example-0.1.0",
        "activityVersion": "CS03-STACK-01-TRACE@0.1.0",
    }
    assert HelpPayload.model_validate(event).reply == event["reply"]
    with pytest.raises(ValidationError):
        incomplete = {key: value for key, value in event.items() if key != "revisionId"}
        HelpPayload.model_validate(incomplete)
