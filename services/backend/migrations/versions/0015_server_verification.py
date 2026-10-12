"""Server-owned execution ledger backing human-review evidence.

A review may only cite a ``server_tool`` result the platform itself produced by
actually running the student's synced work in the isolated worker. This table
records those runs (owner, work fingerprint, revision, course context, checker
version and outcome); rows are insert-only for the owning account.

Revision ID: 0015_server_verification
Revises: 0014_review_work_snapshot
"""

import sqlalchemy as sa
from alembic import op

revision = "0015_server_verification"
down_revision = "0014_review_work_snapshot"
branch_labels = None
depends_on = None

ACCT = "nullif(current_setting('vault.account_id', true), '')::uuid"


def upgrade() -> None:
    op.create_table(
        "server_verification",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_account_id", sa.Uuid(), nullable=False),
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_revision_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_hash", sa.LargeBinary(), nullable=False),
        sa.Column("course_code", sa.String(32), nullable=False),
        sa.Column("course_version_id", sa.Uuid(), nullable=True),
        sa.Column("activity_version_id", sa.Uuid(), nullable=False),
        sa.Column("objective_code", sa.String(80), nullable=False),
        sa.Column("task_code", sa.String(100), nullable=False),
        sa.Column("checker_kind", sa.String(24), nullable=False),
        sa.Column("standard_version", sa.String(120), nullable=False),
        sa.Column("provenance", sa.String(24), nullable=False, server_default="server_execution"),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("detail", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["space_id", "owner_account_id"],
            ["learning_space.id", "learning_space.owner_account_id"],
            name="fk_server_verification_space_owner",
        ),
        sa.UniqueConstraint(
            "owner_account_id",
            "artifact_revision_id",
            "artifact_hash",
            "checker_kind",
            "standard_version",
            name="uq_server_verification_work",
        ),
        sa.CheckConstraint(
            "checker_kind IN ('fixed_task','semantic_suite')",
            name="ck_server_verification_kind",
        ),
        sa.CheckConstraint(
            "provenance = 'server_execution'", name="ck_server_verification_provenance"
        ),
        sa.CheckConstraint(
            "outcome IN ('met','not_met','needs_review')",
            name="ck_server_verification_outcome",
        ),
        sa.CheckConstraint(
            "octet_length(artifact_hash) = 32", name="ck_server_verification_hash"
        ),
    )
    op.create_index(
        "ix_server_verification_owner_work",
        "server_verification",
        ["owner_account_id", "artifact_revision_id"],
    )
    op.execute("ALTER TABLE server_verification ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE server_verification FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY owner_only ON server_verification "
        f"USING (owner_account_id = {ACCT}) WITH CHECK (owner_account_id = {ACCT})"
    )
    # The ledger is append-only: a recorded server execution is never rewritten
    # or deleted, so it stays a faithful audit trail.
    op.execute("""CREATE FUNCTION vault_server_verification_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          RAISE EXCEPTION 'server verification records are append-only'
            USING ERRCODE = '23514';
        END $$""")
    op.execute(
        "CREATE TRIGGER server_verification_immutable "
        "BEFORE UPDATE OR DELETE ON server_verification "
        "FOR EACH ROW EXECUTE FUNCTION vault_server_verification_immutable()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER server_verification_immutable ON server_verification")
    op.execute("DROP FUNCTION vault_server_verification_immutable()")
    op.drop_table("server_verification")
