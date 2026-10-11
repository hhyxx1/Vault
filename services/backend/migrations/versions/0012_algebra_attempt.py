"""Native finite-table drafts and immutable submitted work, always client reports."""

from alembic import op

revision = "0012_algebra_attempt"
down_revision = "0011_code_draft"
branch_labels = None
depends_on = None

KINDS = (
    "'draft','revision','evidence','help','teacher_draft','position',"
    "'personal_course','personal_course_version','personal_attempt','personal_assist',"
    "'course_attempt','structured_attempt','code_attempt','code_draft'"
)


def upgrade():
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint(
        "ck_sync_object_type", "sync_object", f"object_type IN ({KINDS},'algebra_attempt')"
    )
    op.execute("""CREATE FUNCTION vault_algebra_attempt_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF OLD.object_type='algebra_attempt' AND (
          NEW.deleted_at IS NOT NULL OR
          (OLD.payload - ARRAY['table','secondTable','mapping','predictions','explanation',
                'result','updatedAt','submittedAt']::text[])
            IS DISTINCT FROM
          (NEW.payload - ARRAY['table','secondTable','mapping','predictions','explanation',
                'result','updatedAt','submittedAt']::text[]) OR
          (OLD.payload->>'submittedAt' IS NOT NULL AND (
            OLD.payload->'result' <> 'null'::jsonb OR
            (OLD.payload - ARRAY['result','updatedAt']::text[]) IS DISTINCT FROM
            (NEW.payload - ARRAY['result','updatedAt']::text[])
          ))
        ) THEN RAISE EXCEPTION 'submitted native algebra version is immutable'
          USING ERRCODE='23514'; END IF;
        RETURN NEW; END $$""")
    op.execute("""CREATE TRIGGER algebra_attempt_guard BEFORE UPDATE ON sync_object
        FOR EACH ROW EXECUTE FUNCTION vault_algebra_attempt_guard()""")


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (
        SELECT 1 FROM sync_object WHERE object_type='algebra_attempt'
        ) THEN RAISE EXCEPTION 'cannot downgrade while native algebra work exists';
        END IF; END $$""")
    op.execute("DROP TRIGGER algebra_attempt_guard ON sync_object")
    op.execute("DROP FUNCTION vault_algebra_attempt_guard()")
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint("ck_sync_object_type", "sync_object", f"object_type IN ({KINDS})")
