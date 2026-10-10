"""Frozen code work and bounded, untrusted execution reports."""

from alembic import op

revision = "0010_code_attempt"
down_revision = "0009_structured_attempt"
branch_labels = None
depends_on = None

KINDS = (
    "'draft','revision','evidence','help','teacher_draft','position',"
    "'personal_course','personal_course_version','personal_attempt','personal_assist',"
    "'course_attempt','structured_attempt'"
)


def upgrade() -> None:
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint(
        "ck_sync_object_type", "sync_object", f"object_type IN ({KINDS},'code_attempt')"
    )
    # Independent trigger preserves every guard installed by earlier migrations.
    op.execute("""CREATE FUNCTION vault_code_attempt_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF OLD.object_type='code_attempt' AND (
          NEW.deleted_at IS NOT NULL OR OLD.payload->'result' <> 'null'::jsonb OR
          (OLD.payload - ARRAY['result','updatedAt']::text[]) IS DISTINCT FROM
          (NEW.payload - ARRAY['result','updatedAt']::text[])
        ) THEN RAISE EXCEPTION 'submitted code version is immutable'
          USING ERRCODE='23514'; END IF;
        RETURN NEW; END $$""")
    op.execute("""CREATE TRIGGER code_attempt_guard BEFORE UPDATE ON sync_object
        FOR EACH ROW EXECUTE FUNCTION vault_code_attempt_guard()""")


def downgrade() -> None:
    op.execute("""DO $$ BEGIN IF EXISTS (
        SELECT 1 FROM sync_object WHERE object_type='code_attempt'
        ) THEN RAISE EXCEPTION 'cannot downgrade while code attempts exist'; END IF; END $$""")
    op.execute("DROP TRIGGER code_attempt_guard ON sync_object")
    op.execute("DROP FUNCTION vault_code_attempt_guard()")
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint("ck_sync_object_type", "sync_object", f"object_type IN ({KINDS})")
