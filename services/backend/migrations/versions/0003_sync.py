"""Authenticated local claim and bounded learning sync projection.

Revision ID: 0003_sync
Revises: 0002_auth
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_sync"
down_revision = "0002_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Multiple fixed claim IDs may recover the same already-bound origin, each
    # preserving its original request. learning_space retains UNIQUE(origin).
    op.drop_constraint("sync_claim_origin_local_space_id_key", "sync_claim", type_="unique")
    op.create_index("ix_sync_claim_origin_local_space_id", "sync_claim", ["origin_local_space_id"])

    op.create_table(
        "sync_object",
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("object_type", sa.String(length=24), nullable=False),
        sa.Column("object_id", sa.String(length=100), nullable=False),
        sa.Column("server_object_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.BigInteger(), nullable=False),
        sa.Column("payload_hash", sa.LargeBinary(), nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "provenance", sa.String(length=24), server_default="client_reported", nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(deleted_at IS NULL AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object') OR "
            "(deleted_at IS NOT NULL AND payload IS NULL)",
            name="ck_sync_object_payload",
        ),
        sa.CheckConstraint(
            "object_type IN ('draft','revision','evidence','help','teacher_draft','position')",
            name="ck_sync_object_type",
        ),
        sa.CheckConstraint("provenance = 'client_reported'", name="ck_sync_object_provenance"),
        sa.CheckConstraint("octet_length(payload_hash) = 32", name="ck_sync_object_hash"),
        sa.CheckConstraint("version > 0", name="ck_sync_object_version"),
        sa.ForeignKeyConstraint(
            ["space_id"],
            ["learning_space.id"],
        ),
        sa.PrimaryKeyConstraint("space_id", "object_type", "object_id"),
        sa.UniqueConstraint("server_object_id"),
        sa.UniqueConstraint("space_id", "server_object_id", name="uq_sync_object_server_scope"),
    )
    op.create_table(
        "sync_operation_receipt",
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("op_id", sa.Uuid(), nullable=False),
        sa.Column("command_hash", sa.LargeBinary(), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("jsonb_typeof(result) = 'object'", name="ck_sync_op_result"),
        sa.CheckConstraint("octet_length(command_hash) = 32", name="ck_sync_op_hash"),
        sa.ForeignKeyConstraint(
            ["space_id"],
            ["learning_space.id"],
        ),
        sa.PrimaryKeyConstraint("space_id", "op_id"),
    )
    op.create_table(
        "sync_batch_receipt",
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("command_hash", sa.LargeBinary(), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("jsonb_typeof(result) = 'object'", name="ck_sync_batch_result"),
        sa.CheckConstraint("octet_length(command_hash) = 32", name="ck_sync_batch_hash"),
        sa.ForeignKeyConstraint(
            ["space_id"],
            ["learning_space.id"],
        ),
        sa.PrimaryKeyConstraint("space_id", "batch_id"),
    )
    op.create_table(
        "sync_change",
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.BigInteger(), nullable=False),
        sa.Column("object_type", sa.String(length=24), nullable=False),
        sa.Column("object_id", sa.String(length=100), nullable=False),
        sa.Column("server_object_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.BigInteger(), nullable=False),
        sa.Column("payload_hash", sa.LargeBinary(), nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column("deleted", sa.Boolean(), nullable=False),
        sa.Column(
            "provenance", sa.String(length=24), server_default="client_reported", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(deleted = false AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object') OR "
            "(deleted = true AND payload IS NULL)",
            name="ck_sync_change_payload",
        ),
        sa.CheckConstraint("provenance = 'client_reported'", name="ck_sync_change_provenance"),
        sa.CheckConstraint("octet_length(payload_hash) = 32", name="ck_sync_change_hash"),
        sa.CheckConstraint("sequence > 0 AND version > 0", name="ck_sync_change_versions"),
        sa.ForeignKeyConstraint(
            ["space_id", "object_type", "object_id"],
            ["sync_object.space_id", "sync_object.object_type", "sync_object.object_id"],
            name="fk_sync_change_object_scope",
        ),
        sa.PrimaryKeyConstraint("space_id", "sequence"),
    )
    op.create_table(
        "sync_conflict",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("op_id", sa.Uuid(), nullable=False),
        sa.Column("object_type", sa.String(length=24), nullable=False),
        sa.Column("object_id", sa.String(length=100), nullable=False),
        sa.Column("base_version", sa.BigInteger(), nullable=False),
        sa.Column("current_version", sa.BigInteger(), nullable=False),
        sa.Column("payload_hash", sa.LargeBinary(), nullable=False),
        sa.Column("incoming_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "jsonb_typeof(incoming_payload) = 'object'", name="ck_sync_conflict_payload"
        ),
        sa.CheckConstraint(
            "base_version >= 0 AND current_version > 0", name="ck_sync_conflict_versions"
        ),
        sa.CheckConstraint("octet_length(payload_hash) = 32", name="ck_sync_conflict_hash"),
        sa.ForeignKeyConstraint(
            ["space_id", "object_type", "object_id"],
            ["sync_object.space_id", "sync_object.object_type", "sync_object.object_id"],
            name="fk_sync_conflict_object_scope",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("space_id", "op_id", name="uq_sync_conflict_op"),
    )
    op.create_table(
        "sync_cursor",
        sa.Column("token_digest", sa.LargeBinary(), nullable=False),
        sa.Column("token_value", sa.String(length=43), nullable=False),
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("after_sequence", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("after_sequence >= 0", name="ck_sync_cursor_sequence"),
        sa.CheckConstraint("length(token_value) = 43", name="ck_sync_cursor_value"),
        sa.UniqueConstraint("space_id", "after_sequence", name="uq_sync_cursor_watermark"),
        sa.CheckConstraint("octet_length(token_digest) = 32", name="ck_sync_cursor_digest"),
        sa.ForeignKeyConstraint(
            ["space_id"],
            ["learning_space.id"],
        ),
        sa.PrimaryKeyConstraint("token_digest"),
    )
    op.create_index(op.f("ix_sync_cursor_space_id"), "sync_cursor", ["space_id"], unique=False)

    predicate = (
        "EXISTS (SELECT 1 FROM learning_space s WHERE s.id = space_id AND "
        "s.owner_account_id = nullif(current_setting('vault.account_id', true), '')::uuid)"
    )
    for table in (
        "sync_object",
        "sync_operation_receipt",
        "sync_batch_receipt",
        "sync_change",
        "sync_conflict",
        "sync_cursor",
    ):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY owner_only ON {table} USING ({predicate}) WITH CHECK ({predicate})"
        )
    for table in (
        "sync_operation_receipt",
        "sync_batch_receipt",
        "sync_change",
        "sync_conflict",
        "sync_cursor",
    ):
        op.execute(
            f"CREATE TRIGGER immutable_version BEFORE UPDATE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION vault_append_only()"
        )
    op.execute("""CREATE FUNCTION vault_sync_object_guard() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.space_id IS DISTINCT FROM OLD.space_id OR
             NEW.object_type IS DISTINCT FROM OLD.object_type OR
             NEW.object_id IS DISTINCT FROM OLD.object_id OR
             NEW.server_object_id IS DISTINCT FROM OLD.server_object_id OR
             (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) OR
             NEW.version <> OLD.version + 1
          THEN RAISE EXCEPTION 'sync identity, tombstone and version are protected'
               USING ERRCODE = '23514'; END IF;
          IF OLD.object_type IN ('revision','evidence','help') AND
             NEW.deleted_at IS NULL
          THEN RAISE EXCEPTION 'imported history is immutable' USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$""")
    op.execute(
        "CREATE TRIGGER protect_sync_object BEFORE UPDATE ON sync_object "
        "FOR EACH ROW EXECUTE FUNCTION vault_sync_object_guard()"
    )


def downgrade() -> None:
    op.drop_index("ix_sync_cursor_space_id", table_name="sync_cursor")
    op.drop_index("ix_sync_claim_origin_local_space_id", table_name="sync_claim")
    for table in (
        "sync_cursor",
        "sync_conflict",
        "sync_change",
        "sync_batch_receipt",
        "sync_operation_receipt",
        "sync_object",
    ):
        op.drop_table(table)
    op.execute("DROP FUNCTION vault_sync_object_guard()")
    # Select one original committed claim before restoring the foundation's
    # one-claim-per-origin constraint; all account bindings remain unchanged.
    op.execute(
        "DELETE FROM sync_claim a USING sync_claim b WHERE "
        "a.origin_local_space_id = b.origin_local_space_id AND "
        "(a.committed_at,a.claim_id) > (b.committed_at,b.claim_id)"
    )
    op.create_unique_constraint(
        "sync_claim_origin_local_space_id_key", "sync_claim", ["origin_local_space_id"]
    )
