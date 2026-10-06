"""Authentication additions; the original account and session remain authoritative."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from vault_backend.models import Base


class AccountAuthState(Base):
    __tablename__ = "account_auth_state"

    account_id: Mapped[UUID] = mapped_column(ForeignKey("account.id"), primary_key=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthEmailToken(Base):
    __tablename__ = "auth_email_token"
    __table_args__ = (
        CheckConstraint(
            "purpose IN ('verify_email','reset_password')", name="ck_email_token_purpose"
        ),
        CheckConstraint("octet_length(token_digest) = 32", name="ck_email_token_digest"),
        CheckConstraint("expires_at > created_at", name="ck_email_token_expiry"),
        CheckConstraint(
            "(purpose = 'verify_email' AND pending_password_hash IS NOT NULL AND "
            "pending_account_type IS NOT NULL AND pending_account_type IN ('student','teacher') "
            "AND pending_display_name IS NOT NULL) "
            "OR (purpose = 'reset_password' AND pending_password_hash IS NULL AND "
            "pending_account_type IS NULL AND pending_display_name IS NULL)",
            name="ck_email_token_registration",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("account.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(24))
    token_digest: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pending_password_hash: Mapped[str | None] = mapped_column(Text)
    pending_account_type: Mapped[str | None] = mapped_column(String(16))
    pending_display_name: Mapped[str | None] = mapped_column(String(80))
