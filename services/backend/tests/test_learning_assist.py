import json
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from vault_backend.agent_gateway import DeepSeekResponsesGateway, ModelRouter, OpenAIChatGateway
from vault_backend.api import create_app
from vault_backend.checker import STACK_COURSE_VERSION
from vault_backend.config import Settings
from vault_backend.errors import ApiError
from vault_backend.learning_assist import LearningAssistWorkflow
from vault_backend.learning_assist_schemas import (
    CourseDiscoveryReply,
    CourseDiscoveryRequest,
    LearningAssistReply,
    LearningAssistRequest,
    PersonalLearningAssistRequest,
)
from vault_backend.model_profiles import ModelProfile
from vault_backend.sync_schemas import HelpPayload

ORIGIN = "http://localhost:5173"


def test_assist_accepts_current_course_version_and_rejects_old_scope():
    LearningAssistRequest.model_validate(assist_payload(course_version="CS03-example-0.2.0"))
    with pytest.raises(ValidationError):
        LearningAssistRequest.model_validate(assist_payload(course_version="CS03-example-0.1.0"))


class FakeAssist:
    def __init__(self):
        self.calls = []

    async def run(self, request, verification=None):
        self.calls.append((request, verification))
        return LearningAssistReply(
            message="回看空栈时的输出约定。", next_action="自己写出边界条件后再核验。"
        )

    async def discover_course(self, request):
        self.calls.append((request, None))
        return CourseDiscoveryReply.model_validate(
            {
                "status": "draft",
                "message": "我先把这门课整理成一份待你确认的学习路线。",
                "clarifying_question": None,
                "proposal": {
                    "title": request.course_name,
                    "goal": "能说明路由选择并用小型拓扑验证转发行为。",
                    "topics": [
                        {"title": "网络分层", "expected_performance": "解释一次通信经过的层次。"},
                        {"title": "IP 与子网", "expected_performance": "计算地址范围并识别边界。"},
                        {"title": "路由转发", "expected_performance": "推演路由选择并验证路径。"},
                    ],
                    "first_task": "先用两个节点推演一次通信，并标出仍不确定的步骤。",
                    "assumptions": ["默认从基础概念开始", "厂商设备命令需要后续选择环境"],
                },
                "mastery_asserted": False,
                "content_review_status": "unreviewed_ai_draft",
            }
        )


def assist_payload(**changes):
    payload = {
        "request_id": str(uuid4()),
        "course_code": "CS03",
        "course_version": STACK_COURSE_VERSION,
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


def personal_assist_payload(**changes):
    payload = {
        "request_id": str(uuid4()),
        "model_profile_id": None,
        "course_id": str(uuid4()),
        "scope_version_id": str(uuid4()),
        "topic_id": str(uuid4()),
        "attempt_id": str(uuid4()),
        "course_title": "计算机网络",
        "course_goal": "能够解释路由选择并验证配置",
        "topic_title": "最长前缀匹配",
        "expected_performance": "构造两条路由并解释转发结果",
        "attempt_excerpt": "实际操作：配置两条静态路由。观察：更具体的路由生效。",
        "question": "下一次该改变什么条件？",
        "intent": "practice",
        "disclosure_accepted": True,
    }
    return {**payload, **changes}


def course_discovery_reply_payload(**changes):
    return {
        "status": "draft",
        "message": "我先给出一份可修改的初稿。",
        "clarifying_question": None,
        "proposal": {
            "title": "计算机网络",
            "goal": "解释路由选择并通过小型实践观察转发。",
            "topics": [
                {"title": "分层", "expected_performance": "解释通信各层职责。"},
                {"title": "寻址", "expected_performance": "计算子网边界。"},
                {"title": "转发", "expected_performance": "推演路径并验证结果。"},
            ],
            "first_task": "手工推演两个主机间的一次通信。",
            "assumptions": ["从基础开始"],
        },
        "mastery_asserted": False,
        "content_review_status": "unreviewed_ai_draft",
        **changes,
    }


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


async def test_personal_course_assist_uses_same_bounded_lease_without_claiming_verification(
    settings, store
):
    client, fake, lease, headers = await make_client(settings, store, cap=1)
    try:
        path = f"/api/v1/guest-leases/{lease['lease_id']}/personal-learning-assist"
        payload = personal_assist_payload()
        first = await client.post(path, headers=headers, json=payload)
        replay = await client.post(path, headers=headers, json=payload)
        assert first.status_code == replay.status_code == 200
        assert first.json()["mastery_asserted"] is False
        assert len(fake.calls) == 1
        assert str(fake.calls[0][0].scope_version_id) == payload["scope_version_id"]
        assert fake.calls[0][1] is None
        rejected = await client.post(
            path, headers=headers, json=personal_assist_payload(intent="result_feedback")
        )
        assert rejected.status_code == 422
        assert (
            await client.post(
                path, headers=headers, json=personal_assist_payload(disclosure_accepted=False)
            )
        ).status_code == 422
        assert (
            await client.post(path, headers=headers, json=personal_assist_payload())
        ).status_code == 429
    finally:
        await client.aclose()


def course_discovery_payload(**changes):
    return {
        "request_id": str(uuid4()),
        "model_profile_id": None,
        "course_name": "计算机网络",
        "learning_goal": "想弄清数据包为什么能从一台电脑到达另一台电脑。",
        "current_knowledge": "学过一点 IP 地址，不知道怎么规划内容。",
        "turns": [],
        "disclosure_accepted": True,
        **changes,
    }


async def test_student_can_request_an_editable_ai_course_outline_before_creating_a_course(
    settings, store
):
    client, fake, lease, headers = await make_client(settings, store, cap=1)
    try:
        path = f"/api/v1/guest-leases/{lease['lease_id']}/course-discovery"
        payload = course_discovery_payload()
        first = await client.post(path, headers=headers, json=payload)
        replay = await client.post(path, headers=headers, json=payload)

        assert first.status_code == replay.status_code == 200
        assert replay.json() == first.json()
        assert first.json()["mastery_asserted"] is False
        assert first.json()["content_review_status"] == "unreviewed_ai_draft"
        assert len(first.json()["proposal"]["topics"]) == 3
        assert fake.calls[0][0].learning_goal == payload["learning_goal"]
        assert len(fake.calls) == 1
        assert (
            await client.post(
                path, headers=headers, json=course_discovery_payload(disclosure_accepted=False)
            )
        ).status_code == 422
        assert (
            await client.post(path, headers=headers, json=course_discovery_payload())
        ).status_code == 429
    finally:
        await client.aclose()


async def test_course_discovery_requires_model_and_keeps_clarifying_reply_out_of_course_draft(
    settings, store
):
    settings.agent_enabled = False
    app = create_app(settings, store)
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN)
    nonce = (await client.get("/api/v1/guest-nonce")).json()["nonce"]
    lease = (
        await client.post("/api/v1/guest-leases", headers={"Origin": ORIGIN}, json={"nonce": nonce})
    ).json()
    headers = {"Origin": ORIGIN, "Authorization": f"GuestLease {lease['token']}"}
    try:
        response = await client.post(
            f"/api/v1/guest-leases/{lease['lease_id']}/course-discovery",
            headers=headers,
            json=course_discovery_payload(),
        )
        assert response.status_code == 503
        with pytest.raises(ValidationError):
            CourseDiscoveryReply.model_validate(
                {
                    "status": "clarifying",
                    "message": "先补充一下",
                    "clarifying_question": "你更想练哪类问题？",
                    "proposal": {
                        "title": "错误地提前生成",
                        "goal": "",
                        "topics": [],
                        "first_task": "",
                        "assumptions": [],
                    },
                    "mastery_asserted": False,
                    "content_review_status": "unreviewed_ai_draft",
                }
            )
        with pytest.raises(ValidationError):
            CourseDiscoveryRequest.model_validate(
                course_discovery_payload(disclosure_accepted=False)
            )
    finally:
        await client.aclose()


async def test_custom_model_router_sends_course_discovery_to_selected_profile():
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
                                course_discovery_reply_payload(), ensure_ascii=False
                            )
                        }
                    }
                ]
            },
        )

    profile = ModelProfile(
        id="course_planner",
        label="课程规划模型",
        provider="兼容服务",
        protocol="openai_chat",
        base_url="http://127.0.0.1:11434/v1/",
        model="planner-v2",
        capabilities={"text", "json"},
    )
    gateway = OpenAIChatGateway(profile, None, 5, 1, httpx.MockTransport(respond))
    router = ModelRouter(
        {"course_planner": gateway}, [profile], {"course_discovery": "course_planner"}
    )
    try:
        request = CourseDiscoveryRequest.model_validate(course_discovery_payload())
        reply = await router.discover_course(
            "return the bounded course schema",
            {"course_name": request.course_name},
            request.model_profile_id,
        )
        assert reply.content_review_status == "unreviewed_ai_draft"
        assert reply.mastery_asserted is False
        assert seen[0][0] == "http://127.0.0.1:11434/v1/chat/completions"
        assert seen[0][1]["model"] == "planner-v2"
        assert "JSON" in seen[0][1]["messages"][0]["content"]
        assert "tools" not in seen[0][1]
    finally:
        await router.close()


async def test_discovery_workflow_marks_student_input_untrusted_and_preserves_turns():
    pytest.importorskip("langgraph.graph")

    class FakeGateway:
        async def discover_course(self, instructions, context):
            self.instructions, self.context = instructions, context
            return CourseDiscoveryReply.model_validate(course_discovery_reply_payload())

        async def close(self):
            return None

    gateway = FakeGateway()
    workflow = LearningAssistWorkflow(gateway)
    body = CourseDiscoveryRequest.model_validate(
        course_discovery_payload(turns=[{"role": "learner", "content": "我想先画图和做小实验。"}])
    )
    reply = await workflow.discover_course(body)
    assert reply.content_review_status == "unreviewed_ai_draft"
    assert gateway.context["turns"][0]["content"] == "我想先画图和做小实验。"
    assert "不可信数据" in gateway.instructions
    assert "不要编造引用" in gateway.instructions
    await workflow.close()


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


def test_deployment_can_assign_a_different_model_to_course_discovery():
    profile = ModelProfile(
        id="planner",
        label="规划模型",
        provider="本地",
        protocol="openai_chat",
        base_url="http://127.0.0.1:11434/v1/",
        model="course-planner",
        capabilities={"text"},
    )
    settings = Settings(
        environment="test",
        model_profiles=[profile],
        model_task_defaults={"course_discovery": "planner"},
    )
    assert settings.model_task_defaults["course_discovery"] == "planner"


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


async def test_personal_workflow_labels_learner_context_unverified_and_excludes_account_data():
    pytest.importorskip("langgraph.graph")

    class FakeGateway:
        async def complete(self, instructions, context):
            self.instructions, self.context = instructions, context
            return LearningAssistReply(
                message="改变目的网段后再试。", next_action="记录新的路由表。"
            )

        async def close(self):
            return None

    gateway = FakeGateway()
    workflow = LearningAssistWorkflow(gateway)
    reply = await workflow.run(
        PersonalLearningAssistRequest.model_validate(personal_assist_payload()), None
    )
    assert reply.mastery_asserted is False
    assert gateway.context["course_title"] == "计算机网络"
    assert gateway.context["student_attempt_excerpt"].startswith("实际操作")
    assert gateway.context["verification"] is None
    assert "未核验" in gateway.instructions
    assert "account_id" not in gateway.context
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
