"""Allow dependency-checked tombstones for student-owned personal courses."""

from alembic import op

revision = "0017_personal_course_delete"
down_revision = "0016_review_course_code_width"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """CREATE OR REPLACE FUNCTION vault_sync_object_guard() RETURNS trigger
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

          IF OLD.deleted_at IS NOT NULL
          THEN RAISE EXCEPTION 'deleted history is immutable'
               USING ERRCODE = '23514'; END IF;

          IF NEW.deleted_at IS NOT NULL THEN
            IF NEW.payload IS NOT NULL
            THEN RAISE EXCEPTION 'tombstones cannot retain a live payload'
                 USING ERRCODE = '23514'; END IF;
            IF OLD.object_type IN (
              'course_attempt','structured_attempt','code_attempt','algebra_attempt'
            ) THEN RAISE EXCEPTION 'checked course attempts are immutable'
                 USING ERRCODE = '23514'; END IF;
            IF OLD.object_type IN (
              'personal_course','personal_course_version','personal_attempt','personal_assist'
            ) AND current_setting('vault.allow_personal_delete', true) IS DISTINCT FROM '1'
            THEN RAISE EXCEPTION 'personal-course deletion requires the authorized sync flow'
                 USING ERRCODE = '23514'; END IF;

            IF OLD.object_type = 'personal_course' AND EXISTS (
              SELECT 1 FROM sync_object child
              WHERE child.space_id = OLD.space_id
                AND child.object_type IN (
                  'personal_course_version','personal_attempt','personal_assist'
                )
                AND child.deleted_at IS NULL
                AND child.payload->>'courseId' = OLD.object_id
            ) THEN RAISE EXCEPTION 'personal course still has active records'
                 USING ERRCODE = '23514'; END IF;
            IF OLD.object_type = 'personal_course_version' AND EXISTS (
              SELECT 1 FROM sync_object child
              WHERE child.space_id = OLD.space_id
                AND child.object_type = 'personal_attempt'
                AND child.deleted_at IS NULL
                AND child.payload->>'scopeVersionId' = OLD.object_id
            ) THEN RAISE EXCEPTION 'personal course scope still has active attempts'
                 USING ERRCODE = '23514'; END IF;
            IF OLD.object_type = 'personal_attempt' AND EXISTS (
              SELECT 1 FROM sync_object child
              WHERE child.space_id = OLD.space_id
                AND child.object_type = 'personal_assist'
                AND child.deleted_at IS NULL
                AND child.payload->>'attemptId' = OLD.object_id
            ) THEN RAISE EXCEPTION 'personal attempt still has active assistant records'
                 USING ERRCODE = '23514'; END IF;
            RETURN NEW;
          END IF;

          IF OLD.object_type IN (
            'revision','evidence','help','personal_course_version',
            'personal_attempt','personal_assist'
          ) THEN RAISE EXCEPTION 'imported history is immutable'
               USING ERRCODE = '23514'; END IF;
          IF OLD.object_type IN ('course_attempt','structured_attempt')
             AND OLD.payload->'result' <> 'null'::jsonb
          THEN RAISE EXCEPTION 'checked course attempt is immutable'
               USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$"""
    )


def downgrade() -> None:
    op.execute(
        """DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM sync_object
                   WHERE object_type='personal_course_version' AND deleted_at IS NOT NULL)
        THEN RAISE EXCEPTION 'cannot downgrade while deleted personal scope versions exist';
        END IF;
        END $$"""
    )
    op.execute(
        """CREATE OR REPLACE FUNCTION vault_sync_object_guard() RETURNS trigger
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
          IF OLD.object_type IN ('course_attempt','structured_attempt')
             AND OLD.payload->'result' <> 'null'::jsonb
          THEN RAISE EXCEPTION 'checked course attempt is immutable'
               USING ERRCODE = '23514'; END IF;
          IF OLD.object_type IN
             ('revision','evidence','help','personal_attempt','personal_assist') AND
             NEW.deleted_at IS NULL
          THEN RAISE EXCEPTION 'imported history is immutable' USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END $$"""
    )
