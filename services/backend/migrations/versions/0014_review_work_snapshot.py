"""Freeze the real work a review assignment references, append-only.

Revision ID: 0014_review_work_snapshot
Revises: 0013_human_review
"""

import sqlalchemy as sa
from alembic import op

revision = "0014_review_work_snapshot"
down_revision = "0013_human_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "review_assignment",
        sa.Column(
            "work_snapshot",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    # work_snapshot is a list of frozen work versions (the original submission
    # plus every resubmitted revision). New entries may only be appended; an
    # existing prefix can never be rewritten, so a submitted work stays frozen.
    op.execute("""CREATE FUNCTION vault_review_work_snapshot_append() RETURNS trigger
        LANGUAGE plpgsql AS $$ DECLARE i integer; BEGIN
          IF NEW.work_snapshot IS NULL OR jsonb_typeof(NEW.work_snapshot) <> 'array' THEN
            RAISE EXCEPTION 'work_snapshot must be a JSON array' USING ERRCODE = '23514';
          END IF;
          IF jsonb_array_length(NEW.work_snapshot) < jsonb_array_length(OLD.work_snapshot) THEN
            RAISE EXCEPTION 'review work snapshot is append-only' USING ERRCODE = '23514';
          END IF;
          FOR i IN 0 .. jsonb_array_length(OLD.work_snapshot) - 1 LOOP
            IF NEW.work_snapshot -> i IS DISTINCT FROM OLD.work_snapshot -> i THEN
              RAISE EXCEPTION 'review work snapshot is append-only' USING ERRCODE = '23514';
            END IF;
          END LOOP;
          RETURN NEW;
        END $$""")
    op.execute(
        "CREATE TRIGGER protect_review_work_snapshot BEFORE UPDATE ON review_assignment "
        "FOR EACH ROW EXECUTE FUNCTION vault_review_work_snapshot_append()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER protect_review_work_snapshot ON review_assignment")
    op.execute("DROP FUNCTION vault_review_work_snapshot_append()")
    op.drop_column("review_assignment", "work_snapshot")
