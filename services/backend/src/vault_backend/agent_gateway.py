import asyncio
import json
from typing import Any

import httpx
from pydantic import ValidationError

from vault_backend.errors import ApiError
from vault_backend.learning_assist_schemas import LearningAssistReply


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
