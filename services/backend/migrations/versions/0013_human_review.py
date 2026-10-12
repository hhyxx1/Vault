"""Human review assignments and immutable review events with scoped teacher access.

Revision ID: 0013_human_review
Revises: 0012_algebra_attempt
"""

import sqlalchemy as sa
from alembic import op

revision = "0013_human_review"
down_revision = "0012_algebra_attempt"
branch_labels = None
depends_on = None

ACCT = "nullif(current_setting('vault.account_id', true), '')::uuid"
VERIFIED_TEACHER = (
    "EXISTS (SELECT 1 FROM teacher_profile tp "
    "WHERE tp.account_id = nullif(current_setting('vault.account_id', true), '')::uuid "
    "AND tp.verification_state = 'verified')"
)
# A teacher may see an assignment only when the student explicitly scoped it to
# the platform teacher pool, named that teacher, or the teacher already claimed it.
ASSIGNMENT_VISIBLE = (
    f"owner_account_id = {ACCT} OR teacher_account_id = {ACCT} "
    f"OR claimed_by_account_id = {ACCT} "
    f"OR (audience = 'platform_teachers' AND {VERIFIED_TEACHER})"
)
ASSIGNMENT_WRITABLE = (
    f"owner_account_id = {ACCT} OR claimed_by_account_id = {ACCT} "
    f"OR teacher_account_id = {ACCT}"
)


def upgrade() -> None:
    op.create_table(
        "review_assignment",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("owner_account_id", sa.Uuid(), nullable=False),
        sa.Column("audience", sa.String(24), nullable=False),
        sa.Column("teacher_account_id", sa.Uuid(), nullable=True),
        sa.Column("course_code", sa.String(32), nullable=False),
        sa.Column("course_version_id", sa.Uuid(), nullable=True),
        sa.Column("objective_code", sa.String(80), nullable=False),
        sa.Column("activity_version", sa.String(120), nullable=False),
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_revision_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_hash", sa.LargeBinary(), nullable=False),
        sa.Column("rubric", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column(
            "evidence_snapshot",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "status", sa.String(24), nullable=False, server_default="awaiting_review"
        ),
        sa.Column("claimed_by_account_id", sa.Uuid(), nullable=True),
        sa.Column(
            "review_service_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("appeal_count", sa.Integer(), nullable=False, server_default="0"),
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
        sa.UniqueConstraint("space_id", "id", name="uq_review_assignment_space"),
        sa.ForeignKeyConstraint(
            ["space_id", "owner_account_id"],
            ["learning_space.id", "learning_space.owner_account_id"],
            name="fk_review_assignment_space_owner",
        ),
        sa.ForeignKeyConstraint(
            ["teacher_account_id"], ["account.id"], name="fk_review_assignment_teacher"
        ),
        sa.ForeignKeyConstraint(
            ["claimed_by_account_id"],
            ["account.id"],
            name="fk_review_assignment_claimant",
        ),
        sa.CheckConstraint(
            "audience IN ('platform_teachers','specific_teacher')",
            name="ck_review_assignment_audience",
        ),
        sa.CheckConstraint(
            "status IN ('awaiting_review','claimed','changes_requested','resubmitted',"
            "'in_appeal','approved')",
            name="ck_review_assignment_status",
        ),
        sa.CheckConstraint("appeal_count >= 0", name="ck_review_assignment_appeals"),
        sa.CheckConstraint(
            "audience = 'platform_teachers' OR teacher_account_id IS NOT NULL",
            name="ck_review_assignment_specific_teacher",
        ),
        sa.CheckConstraint(
            "octet_length(artifact_hash) = 32", name="ck_review_assignment_hash"
        ),
    )
    op.create_index(
        "ix_review_assignment_owner_created",
        "review_assignment",
        ["owner_account_id", "created_at"],
    )
    op.create_index(
        "ix_review_assignment_queue",
        "review_assignment",
        ["audience", "status"],
    )

    op.create_table(
        "review_event",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("assignment_id", sa.Uuid(), nullable=False),
        sa.Column("space_id", sa.Uuid(), nullable=False),
        sa.Column("owner_account_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(24), nullable=False),
        sa.Column("actor_account_id", sa.Uuid(), nullable=False),
        sa.Column("actor_role", sa.String(16), nullable=False),
        sa.Column("decision", sa.String(24), nullable=True),
        sa.Column("rubric_results", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("evidence_refs", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("teacher_signature", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("assignment_id", "sequence", name="uq_review_event_sequence"),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["review_assignment.id"],
            name="fk_review_event_assignment",
        ),
        sa.CheckConstraint(
            "type IN ('submitted','resubmitted','claimed','decision','appeal','withdrawn')",
            name="ck_review_event_type",
        ),
        sa.CheckConstraint(
            "actor_role IN ('student','teacher')", name="ck_review_event_role"
        ),
        sa.CheckConstraint(
            "decision IS NULL OR decision IN ('approved','changes_requested')",
            name="ck_review_event_decision",
        ),
    )
    op.create_index(
        "ix_review_event_owner", "review_event", ["owner_account_id"]
    )

    # Row-level security: students reach only their own assignments; teachers
    # reach only work explicitly scoped to them or the verified-teacher pool.
    for table in ("review_assignment", "review_event"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    op.execute(
        f"CREATE POLICY scoped_access ON review_assignment "
        f"USING ({ASSIGNMENT_VISIBLE}) WITH CHECK ({ASSIGNMENT_WRITABLE})"
    )
    op.execute(
        "CREATE POLICY scoped_access ON review_event USING ("
        "EXISTS (SELECT 1 FROM review_assignment ra WHERE ra.id = review_event.assignment_id "
        f"AND ({ASSIGNMENT_VISIBLE}))"
        ") WITH CHECK (owner_account_id = {acct} OR actor_account_id = {acct})".format(
            acct=ACCT
        )
    )

    # Assignment identity and the frozen work snapshot can never be rewritten.
    # Only the workflow status, the (one-time) claimant, appeal counter and
    # updated_at may move, and only forward through the service state machine.
    op.execute("""CREATE FUNCTION vault_review_assignment_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.id IS DISTINCT FROM OLD.id OR
             NEW.space_id IS DISTINCT FROM OLD.space_id OR
             NEW.owner_account_id IS DISTINCT FROM OLD.owner_account_id OR
             NEW.audience IS DISTINCT FROM OLD.audience OR
             NEW.teacher_account_id IS DISTINCT FROM OLD.teacher_account_id OR
             NEW.course_code IS DISTINCT FROM OLD.course_code OR
             NEW.course_version_id IS DISTINCT FROM OLD.course_version_id OR
             NEW.objective_code IS DISTINCT FROM OLD.objective_code OR
             NEW.activity_version IS DISTINCT FROM OLD.activity_version OR
             NEW.artifact_id IS DISTINCT FROM OLD.artifact_id OR
             NEW.artifact_revision_id IS DISTINCT FROM OLD.artifact_revision_id OR
             NEW.artifact_hash IS DISTINCT FROM OLD.artifact_hash OR
             NEW.rubric IS DISTINCT FROM OLD.rubric OR
             NEW.evidence_snapshot IS DISTINCT FROM OLD.evidence_snapshot OR
             NEW.review_service_available IS DISTINCT FROM OLD.review_service_available OR
             NEW.created_at IS DISTINCT FROM OLD.created_at OR
             (OLD.claimed_by_account_id IS NOT NULL AND
                NEW.claimed_by_account_id IS DISTINCT FROM OLD.claimed_by_account_id) OR
             NEW.appeal_count < OLD.appeal_count
          THEN RAISE EXCEPTION 'review assignment identity and snapshot are protected'
               USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$""")
    op.execute(
        "CREATE TRIGGER protect_review_assignment BEFORE UPDATE ON review_assignment "
        "FOR EACH ROW EXECUTE FUNCTION vault_review_assignment_guard()"
    )
    # Review history is append-only.
    op.execute("""CREATE FUNCTION vault_review_event_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          RAISE EXCEPTION 'review events are append-only' USING ERRCODE = '23514';
        END $$""")
    op.execute(
        "CREATE TRIGGER review_event_immutable BEFORE UPDATE OR DELETE ON review_event "
        "FOR EACH ROW EXECUTE FUNCTION vault_review_event_immutable()"
    )
    # Returns only whether a usable reviewer exists, never teacher identity, so a
    # student session (whose RLS hides other accounts' profiles) can learn whether
    # a review service is actually staffed before the UI claims a teacher is lined up.
    op.execute("""CREATE FUNCTION vault_verified_teacher_exists(p_teacher uuid DEFAULT NULL)
        RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
          SELECT EXISTS (
            SELECT 1 FROM teacher_profile tp
            JOIN account a ON a.id = tp.account_id
            WHERE tp.verification_state = 'verified' AND a.status = 'active'
              AND (p_teacher IS NULL OR tp.account_id = p_teacher)
          );
        $$""")


def downgrade() -> None:
    op.execute("DROP FUNCTION vault_verified_teacher_exists(uuid)")
    op.execute("DROP TRIGGER review_event_immutable ON review_event")
    op.execute("DROP FUNCTION vault_review_event_immutable()")
    op.execute("DROP TRIGGER protect_review_assignment ON review_assignment")
    op.execute("DROP FUNCTION vault_review_assignment_guard()")
    op.drop_table("review_event")
    op.drop_table("review_assignment")
