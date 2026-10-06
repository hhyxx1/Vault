"""Account Agent run authority, separate from resumable checkpoints.

Revision ID: 0004_agent_run
Revises: 0003_sync
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_agent_run"
down_revision = "0003_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_run",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("owner_account_id", sa.Uuid(), nullable=False),
        sa.Column("activity_version", sa.String(120), nullable=False),
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("revision_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("call_budget", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("calls_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["space_id", "owner_account_id"],
            ["learning_space.id", "learning_space.owner_account_id"],
            name="fk_agent_run_space_owner",
        ),
        sa.CheckConstraint(
            "status IN ('pending','running','waiting','completed','failed','cancelled')",
            name="ck_agent_run_status",
        ),
        sa.CheckConstraint(
            "call_budget > 0 AND calls_used >= 0 AND calls_used <= call_budget",
            name="ck_agent_run_budget",
        ),
        sa.CheckConstraint(
            "graph_version <> '' AND activity_version <> ''", name="ck_agent_run_versions"
        ),
    )
    op.create_index("ix_agent_run_owner_created", "agent_run", ["owner_account_id", "created_at"])
    op.execute("ALTER TABLE agent_run ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE agent_run FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY owner_only ON agent_run "
        "USING (owner_account_id = nullif(current_setting('vault.account_id', true), '')::uuid) "
        "WITH CHECK (owner_account_id = "
        "nullif(current_setting('vault.account_id', true), '')::uuid)"
    )
    # Identity and accounting cannot be rewritten by the runtime role. A later
    # workflow service updates only status, call usage, and updated_at under lock.
    op.execute("""CREATE FUNCTION vault_agent_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.id IS DISTINCT FROM OLD.id OR
             NEW.space_id IS DISTINCT FROM OLD.space_id OR
             NEW.owner_account_id IS DISTINCT FROM OLD.owner_account_id OR
             NEW.activity_version IS DISTINCT FROM OLD.activity_version OR
             NEW.artifact_id IS DISTINCT FROM OLD.artifact_id OR
             NEW.revision_id IS DISTINCT FROM OLD.revision_id OR
             NEW.graph_version IS DISTINCT FROM OLD.graph_version OR
             NEW.call_budget IS DISTINCT FROM OLD.call_budget OR
             NEW.created_at IS DISTINCT FROM OLD.created_at OR
             NEW.calls_used < OLD.calls_used OR
             NEW.updated_at < OLD.updated_at OR
             OLD.status IN ('completed','failed','cancelled')
          THEN RAISE EXCEPTION 'agent run identity or accounting is protected'
               USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$""")
    op.execute(
        "CREATE TRIGGER protect_agent_run BEFORE UPDATE ON agent_run "
        "FOR EACH ROW EXECUTE FUNCTION vault_agent_run_guard()"
    )


def downgrade() -> None:
    op.drop_index("ix_agent_run_owner_created", table_name="agent_run")
    op.drop_table("agent_run")
    op.execute("DROP FUNCTION vault_agent_run_guard()")
