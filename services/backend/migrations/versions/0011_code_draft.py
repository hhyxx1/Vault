"""Editable code work and learning notes, separate from frozen execution reports."""

from alembic import op

revision = "0011_code_draft"
down_revision = "0010_code_attempt"
branch_labels = None
depends_on = None

KINDS = (
    "'draft','revision','evidence','help','teacher_draft','position',"
    "'personal_course','personal_course_version','personal_attempt','personal_assist',"
    "'course_attempt','structured_attempt','code_attempt'"
)


def upgrade() -> None:
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint(
        "ck_sync_object_type", "sync_object", f"object_type IN ({KINDS},'code_draft')"
    )


def downgrade() -> None:
    op.execute("""DO $$ BEGIN IF EXISTS (
        SELECT 1 FROM sync_object WHERE object_type='code_draft'
        ) THEN RAISE EXCEPTION 'cannot downgrade while code drafts exist'; END IF; END $$""")
    op.drop_constraint("ck_sync_object_type", "sync_object", type_="check")
    op.create_check_constraint("ck_sync_object_type", "sync_object", f"object_type IN ({KINDS})")
