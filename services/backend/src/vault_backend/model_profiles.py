"""Trusted deployment model profiles and task routing for the open-source server."""

import re
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


class ModelProfile(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,39}$")
    label: str = Field(min_length=1, max_length=80)
    provider: str = Field(min_length=1, max_length=80)
    protocol: Literal["openai_chat"]
    base_url: HttpUrl
    model: str = Field(min_length=1, max_length=120)
    api_key_env: str | None = Field(default=None, pattern=r"^[A-Z][A-Z0-9_]{0,79}$")
    capabilities: set[Literal["text", "vision", "reasoning", "json", "tools"]] = Field(
        default_factory=lambda: {"text"}
    )

    @model_validator(mode="after")
    def validate_address(self):
        host = self.base_url.host or ""
        if self.base_url.scheme != "https" and host not in {"localhost", "127.0.0.1"}:
            raise ValueError("Remote model endpoints must use HTTPS")
        if (
            self.base_url.username
            or self.base_url.password
            or self.base_url.query
            or self.base_url.fragment
        ):
            raise ValueError("Model endpoint URL must not contain credentials or query data")
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]*", self.model):
            raise ValueError("Model name contains unsupported characters")
        if "text" not in self.capabilities:
            raise ValueError("Learning assistant requires a text-capable model")
        return self


class PublicModelProfile(BaseModel):
    id: str
    label: str
    provider: str
    capabilities: list[str]

    @classmethod
    def from_profile(cls, profile: ModelProfile):
        return cls(
            id=profile.id,
            label=profile.label,
            provider=profile.provider,
            capabilities=sorted(profile.capabilities),
        )


class PublicModelCatalog(BaseModel):
    profiles: list[PublicModelProfile]
    task_defaults: dict[str, str]
