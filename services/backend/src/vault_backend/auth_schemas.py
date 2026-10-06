import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AuthInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nonce: str = Field(min_length=32, max_length=128)


class EmailInput(AuthInput):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(
            r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", value
        ):
            raise ValueError("Email format is not supported")
        if len(value.rsplit("@", 1)[0]) > 64 or ".." in value:
            raise ValueError("Email format is not supported")
        return value


class LoginInput(EmailInput):
    password: str = Field(min_length=1, max_length=128)


class RegisterInput(EmailInput):
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)
    account_type: Literal["student", "teacher"]

    @field_validator("display_name")
    @classmethod
    def name_valid(cls, value: str) -> str:
        value = value.strip()
        if not value or any(ord(char) < 32 for char in value):
            raise ValueError("Display name is empty or contains control characters")
        return value


class TokenInput(AuthInput):
    token: str = Field(min_length=32, max_length=128)


class ResetConfirmInput(TokenInput):
    password: str = Field(min_length=12, max_length=128)


class NonceOutput(BaseModel):
    nonce: str


class AccountOutput(BaseModel):
    id: UUID
    email: str
    display_name: str
    account_type: Literal["student", "teacher"]
    teacher_verification_state: Literal["pending", "verified", "rejected", "suspended"] | None


class AccountSessionOutput(BaseModel):
    account: AccountOutput


class LoginOutput(AccountSessionOutput):
    csrf_token: str


class CSRFOutput(BaseModel):
    csrf_token: str


class ConfirmationOutput(BaseModel):
    status: Literal["confirmation_required"] = "confirmation_required"


class ConfirmedOutput(BaseModel):
    status: Literal["email_confirmed"] = "email_confirmed"


class ResetRequestedOutput(BaseModel):
    status: Literal["reset_requested"] = "reset_requested"


class PasswordResetOutput(BaseModel):
    status: Literal["password_reset"] = "password_reset"
