import asyncio
import json
import os
from typing import Any

import httpx
from pydantic import ValidationError

from vault_backend.errors import ApiError
from vault_backend.learning_assist_schemas import LearningAssistReply
from vault_backend.model_profiles import ModelProfile, PublicModelProfile


class DeepSeekResponsesGateway:
    """Narrow, stateless Responses API adapter. It exposes no tools to model output."""

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: int,
        max_inflight: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.model = model
        self.client = httpx.AsyncClient(
            base_url="https://api.deepseek.com",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_seconds,
            transport=transport,
        )
        self.capacity = asyncio.Semaphore(max_inflight)

    async def close(self) -> None:
        await self.client.aclose()

    async def complete(self, instructions: str, context: dict[str, Any]) -> LearningAssistReply:
        body = {
            "model": self.model,
            "instructions": instructions,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": json.dumps(context, ensure_ascii=False)}
                    ],
                }
            ],
            "max_output_tokens": 1000,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "learning_assist_reply",
                    "schema": LearningAssistReply.model_json_schema(),
                }
            },
        }
        try:
            async with self.capacity:
                response = await self.client.post("/responses", json=body)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise ApiError(
                502,
                "AGENT_PROVIDER_UNAVAILABLE",
                "学习助手暂时不可用；你的作品仍保存在本地。",
                retryable=True,
            ) from None
        if not isinstance(payload, dict):
            raise ApiError(
                502, "AGENT_RESPONSE_INVALID", "学习助手返回格式暂不可用。", retryable=True
            )
        if payload.get("status") != "completed":
            raise ApiError(
                502, "AGENT_RESPONSE_INVALID", "学习助手没有完成本次回复。", retryable=True
            )
        text_parts = []
        output = payload.get("output")
        if isinstance(output, list):
            for item in output:
                if not isinstance(item, dict) or item.get("type") != "message":
                    continue
                content = item.get("content")
                if not isinstance(content, list):
                    continue
                text_parts.extend(
                    part["text"]
                    for part in content
                    if isinstance(part, dict)
                    and part.get("type") == "output_text"
                    and isinstance(part.get("text"), str)
                )
        if not text_parts:
            raise ApiError(
                502, "AGENT_RESPONSE_INVALID", "学习助手返回内容暂不可用。", retryable=True
            )
        try:
            return LearningAssistReply.model_validate_json("".join(text_parts))
        except (ValidationError, ValueError):
            raise ApiError(
                502, "AGENT_RESPONSE_INVALID", "学习助手返回格式暂不可用。", retryable=True
            ) from None


class OpenAIChatGateway:
    """Bounded Chat Completions adapter; no tools, redirects, or trusted model output."""

    def __init__(
        self,
        profile: ModelProfile,
        api_key: str | None,
        timeout_seconds: int,
        max_inflight: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.profile = profile
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self.client = httpx.AsyncClient(
            base_url=str(profile.base_url).rstrip("/") + "/",
            headers=headers,
            timeout=timeout_seconds,
            follow_redirects=False,
            transport=transport,
        )
        self.capacity = asyncio.Semaphore(max_inflight)

    async def close(self) -> None:
        await self.client.aclose()

    async def complete(self, instructions: str, context: dict[str, Any]) -> LearningAssistReply:
        body = {
            "model": self.profile.model,
            "messages": [
                {
                    "role": "system",
                    "content": instructions
                    + "\n只输出含 message、next_action、mastery_asserted=false 的 JSON 对象。",
                },
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
            ],
            "max_tokens": 1000,
            "stream": False,
        }
        try:
            async with self.capacity:
                response = await self.client.post("chat/completions", json=body)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise ApiError(
                502,
                "AGENT_PROVIDER_UNAVAILABLE",
                "学习助手暂时不可用；你的作品仍保存在本地。",
                retryable=True,
            ) from None
        try:
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise ValueError("non-text model output")
            return LearningAssistReply.model_validate_json(content)
        except (KeyError, IndexError, TypeError, ValueError, ValidationError):
            raise ApiError(
                502, "AGENT_RESPONSE_INVALID", "学习助手返回格式暂不可用。", retryable=True
            ) from None


class ModelRouter:
    def __init__(
        self, gateways: dict[str, Any], profiles: list[PublicModelProfile], defaults: dict[str, str]
    ):
        self.gateways = gateways
        self.profiles = profiles
        self.defaults = defaults
        self.first = next(iter(gateways))

    @classmethod
    def from_settings(cls, settings):
        gateways: dict[str, Any] = {}
        profiles = []
        if settings.deepseek_api_key:
            gateways["legacy_deepseek"] = DeepSeekResponsesGateway(
                settings.deepseek_api_key.get_secret_value(),
                settings.deepseek_model,
                settings.agent_timeout_seconds,
                settings.agent_max_inflight,
            )
            profiles.append(
                PublicModelProfile(
                    id="legacy_deepseek",
                    label="DeepSeek 默认模型",
                    provider="DeepSeek",
                    capabilities=["json", "text"],
                )
            )
        for profile in settings.model_profiles:
            key = os.environ.get(profile.api_key_env, "").strip() if profile.api_key_env else None
            if profile.api_key_env and not key:
                raise ValueError(f"Missing credential environment variable for model {profile.id}")
            gateways[profile.id] = OpenAIChatGateway(
                profile, key, settings.agent_timeout_seconds, settings.agent_max_inflight
            )
            profiles.append(PublicModelProfile.from_profile(profile))
        if not gateways:
            raise ValueError("No model gateway is available")
        return cls(gateways, profiles, settings.model_task_defaults)

    def select(self, intent: str, profile_id: str | None = None):
        selected = profile_id or self.defaults.get(intent) or self.first
        gateway = self.gateways.get(selected)
        if gateway is None:
            raise ApiError(422, "MODEL_PROFILE_UNAVAILABLE", "所选模型配置不可用，请重新选择。")
        return gateway

    async def complete(
        self, instructions: str, context: dict[str, Any], profile_id: str | None = None
    ) -> LearningAssistReply:
        gateway = self.select(context["intent"], profile_id)
        return await gateway.complete(instructions, context)

    async def close(self) -> None:
        for gateway in self.gateways.values():
            await gateway.close()
