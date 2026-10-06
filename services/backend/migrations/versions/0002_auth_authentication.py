"""Verified email and one-time authentication tokens.

Revision ID: 0002_auth
Revises: 0001_foundation
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_auth"
down_revision: str | Sequence[str] | None = "0001_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "account_auth_state",
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["account.id"]),
        sa.PrimaryKeyConstraint("account_id"),
    )
    op.create_table(
        "auth_email_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(24), nullable=False),
        sa.Column("token_digest", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pending_password_hash", sa.Text(), nullable=True),
        sa.Column("pending_account_type", sa.String(16), nullable=True),
        sa.Column("pending_display_name", sa.String(80), nullable=True),
        sa.CheckConstraint(
            "purpose IN ('verify_email','reset_password')", name="ck_email_token_purpose"
        ),
        sa.CheckConstraint("octet_length(token_digest) = 32", name="ck_email_token_digest"),
        sa.CheckConstraint("expires_at > created_at", name="ck_email_token_expiry"),
        sa.CheckConstraint(
            "(purpose = 'verify_email' AND pending_password_hash IS NOT NULL AND "
            "pending_account_type IS NOT NULL AND pending_account_type IN ('student','teacher') "
            "AND pending_display_name IS NOT NULL) "
            "OR (purpose = 'reset_password' AND pending_password_hash IS NULL AND "
            "pending_account_type IS NULL AND pending_display_name IS NULL)",
            name="ck_email_token_registration",
        ),
        sa.ForeignKeyConstraint(["account_id"], ["account.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index("ix_auth_email_token_account_id", "auth_email_token", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_email_token_account_id", table_name="auth_email_token")
    op.drop_table("auth_email_token")
    op.drop_table("account_auth_state")
