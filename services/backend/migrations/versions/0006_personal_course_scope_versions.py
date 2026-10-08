"""Add immutable, explicitly confirmed personal-course scope snapshots.

Revision ID: 0006_personal_course_scope_versions
Revises: 0005_personal_course_sync
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_personal_course_scope_versions"
down_revision = "0005_personal_course_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alembic's default version column is varchar(32), while this published
    # revision identifier is longer. Widen it before Alembic records the step.
    op.alter_column("alembic_version", "version_num", type_=sa.String(length=64))
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint(
        "ck_sync_object_type",
        "sync_object",
        "object_type IN ('draft','revision','evidence','help','teacher_draft','position',"
        "'personal_course','personal_course_version','personal_attempt')",
    )
    op.execute("""CREATE OR REPLACE FUNCTION vault_sync_object_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.space_id IS DISTINCT FROM OLD.space_id OR
             NEW.object_type IS DISTINCT FROM OLD.object_type OR
             NEW.object_id IS DISTINCT FROM OLD.object_id OR
             NEW.server_object_id IS DISTINCT FROM OLD.server_object_id OR
             (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) OR
             NEW.version <> OLD.version + 1
          THEN RAISE EXCEPTION 'sync identity, tombstone and version are protected'
               USING ERRCODE = '23514'; END IF;
          IF OLD.object_type = 'personal_course_version'
          THEN RAISE EXCEPTION 'confirmed course scope versions are immutable'
               USING ERRCODE = '23514'; END IF;
          IF OLD.object_type IN
             ('revision','evidence','help','personal_attempt') AND
             NEW.deleted_at IS NULL
          THEN RAISE EXCEPTION 'imported history is immutable' USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$""")


def downgrade() -> None:
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM sync_object WHERE object_type='personal_course_version') THEN
            RAISE EXCEPTION 'cannot downgrade while confirmed personal-course scopes exist';
        END IF;
    END $$""")
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint(
        "ck_sync_object_type",
        "sync_object",
        "object_type IN ('draft','revision','evidence','help','teacher_draft','position',"
        "'personal_course','personal_attempt')",
    )
    op.execute("""CREATE OR REPLACE FUNCTION vault_sync_object_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.space_id IS DISTINCT FROM OLD.space_id OR
             NEW.object_type IS DISTINCT FROM OLD.object_type OR
             NEW.object_id IS DISTINCT FROM OLD.object_id OR
             NEW.server_object_id IS DISTINCT FROM OLD.server_object_id OR
             (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) OR
             NEW.version <> OLD.version + 1
          THEN RAISE EXCEPTION 'sync identity, tombstone and version are protected'
               USING ERRCODE = '23514'; END IF;
          IF OLD.object_type IN ('revision','evidence','help','personal_attempt') AND
             NEW.deleted_at IS NULL
          THEN RAISE EXCEPTION 'imported history is immutable' USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$""")
