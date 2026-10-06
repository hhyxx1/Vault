from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "account"
    __table_args__ = (
        UniqueConstraint("id", "account_type", name="uq_account_id_type"),
        CheckConstraint("account_type IN ('student','teacher')", name="ck_account_type"),
        CheckConstraint("status IN ('active','suspended','deleted')", name="ck_account_status"),
        CheckConstraint("auth_revision > 0", name="ck_account_revision"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    account_type: Mapped[str] = mapped_column(String(16))
    email_normalized: Mapped[str] = mapped_column(String(320), unique=True)
    email_display: Mapped[str] = mapped_column(String(320))
    password_hash: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default="active")
    auth_revision: Mapped[int] = mapped_column(BigInteger, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class StudentProfile(Base):
    __tablename__ = "student_profile"
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id", "account_type"],
            ["account.id", "account.account_type"],
            name="fk_student_account_type",
        ),
        CheckConstraint("account_type = 'student'", name="ck_student_type"),
    )
    account_id: Mapped[UUID] = mapped_column(primary_key=True)
    account_type: Mapped[str] = mapped_column(String(16), server_default="student")
    display_name: Mapped[str] = mapped_column(String(80))


class TeacherProfile(Base):
    __tablename__ = "teacher_profile"
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id", "account_type"],
            ["account.id", "account.account_type"],
            name="fk_teacher_account_type",
        ),
        CheckConstraint("account_type = 'teacher'", name="ck_teacher_type"),
        CheckConstraint(
            "verification_state IN ('pending','verified','rejected','suspended')",
            name="ck_teacher_verification",
        ),
        CheckConstraint("verification_revision > 0", name="ck_teacher_revision"),
    )
    account_id: Mapped[UUID] = mapped_column(primary_key=True)
    account_type: Mapped[str] = mapped_column(String(16), server_default="teacher")
    display_name: Mapped[str] = mapped_column(String(80))
    verification_state: Mapped[str] = mapped_column(String(16), server_default="pending")
    verification_revision: Mapped[int] = mapped_column(BigInteger, server_default="1")


class AuthSession(Base):
    __tablename__ = "auth_session"
    __table_args__ = (
        CheckConstraint("octet_length(token_digest) = 32", name="ck_session_token_digest"),
        CheckConstraint("octet_length(csrf_digest) = 32", name="ck_session_csrf_digest"),
        CheckConstraint("absolute_expires_at > created_at", name="ck_session_absolute_expiry"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("account.id"), index=True)
    token_digest: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    csrf_digest: Mapped[bytes] = mapped_column(LargeBinary)
    auth_revision: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LearningSpace(Base):
    __tablename__ = "learning_space"
    __table_args__ = (
        UniqueConstraint("id", "owner_account_id", name="uq_space_id_owner"),
        CheckConstraint("kind IN ('personal','teaching')", name="ck_space_kind"),
        CheckConstraint("version > 0", name="ck_space_version"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_account_id: Mapped[UUID] = mapped_column(ForeignKey("account.id"), index=True)
    origin_local_id: Mapped[UUID | None] = mapped_column(unique=True)
    kind: Mapped[str] = mapped_column(String(16), server_default="personal")
    version: Mapped[int] = mapped_column(BigInteger, server_default="1")
    bound_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Course(Base):
    __tablename__ = "course"
    __table_args__ = (
        CheckConstraint(
            "origin_kind IN ('platform_default','teacher_custom')", name="ck_course_origin"
        ),
        CheckConstraint(
            "(origin_kind = 'platform_default' AND owner_account_id IS NULL "
            "AND baseline_code IS NOT NULL) OR (origin_kind = 'teacher_custom' "
            "AND owner_account_id IS NOT NULL AND baseline_code IS NULL)",
            name="ck_course_owner_origin",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_account_id: Mapped[UUID | None] = mapped_column(ForeignKey("account.id"))
    origin_kind: Mapped[str] = mapped_column(String(24))
    baseline_code: Mapped[str | None] = mapped_column(String(32), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(BigInteger, server_default="1")


class CourseVersion(Base):
    __tablename__ = "course_version"
    __table_args__ = (
        UniqueConstraint("course_id", "version_no", name="uq_course_version_number"),
        UniqueConstraint("course_id", "id", name="uq_course_version_id"),
        CheckConstraint("version_no > 0", name="ck_course_version_number"),
        CheckConstraint(
            "workflow_state IN ('draft','review','published','withdrawn')",
            name="ck_course_version_workflow",
        ),
        CheckConstraint(
            "review_state IN ('pending','reviewed','rejected')", name="ck_course_review"
        ),
        CheckConstraint("octet_length(content_hash) = 32", name="ck_course_content_hash"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    course_id: Mapped[UUID] = mapped_column(ForeignKey("course.id"))
    version_no: Mapped[int] = mapped_column(BigInteger)
    workflow_state: Mapped[str] = mapped_column(String(16), server_default="draft")
    review_state: Mapped[str] = mapped_column(String(16), server_default="pending")
    content_hash: Mapped[bytes] = mapped_column(LargeBinary)
    scope: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class LearningObjective(Base):
    __tablename__ = "learning_objective"
    __table_args__ = (UniqueConstraint("course_version_id", "code", name="uq_objective_code"),)
    id: Mapped[UUID] = mapped_column(primary_key=True)
    course_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("course_version.id"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(80))
    statement: Mapped[str] = mapped_column(Text)
    necessary_criteria: Mapped[list] = mapped_column(JSONB)


class Artifact(Base):
    __tablename__ = "artifact"
    __table_args__ = (
        UniqueConstraint("space_id", "id", name="uq_artifact_space_id"),
        CheckConstraint("version > 0", name="ck_artifact_version"),
        ForeignKeyConstraint(
            ["space_id", "id", "current_revision_id"],
            ["artifact_version.space_id", "artifact_version.artifact_id", "artifact_version.id"],
            name="fk_artifact_current_revision",
            use_alter=True,
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    space_id: Mapped[UUID] = mapped_column(ForeignKey("learning_space.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    current_revision_id: Mapped[UUID | None] = mapped_column()
    version: Mapped[int] = mapped_column(BigInteger, server_default="1")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ArtifactVersion(Base):
    __tablename__ = "artifact_version"
    __table_args__ = (
        UniqueConstraint("space_id", "artifact_id", "id", name="uq_artifact_revision_scope"),
        ForeignKeyConstraint(
            ["space_id", "artifact_id"],
            ["artifact.space_id", "artifact.id"],
            name="fk_revision_artifact_scope",
        ),
        ForeignKeyConstraint(
            ["space_id", "artifact_id", "parent_revision_id"],
            ["artifact_version.space_id", "artifact_version.artifact_id", "artifact_version.id"],
            name="fk_revision_parent_scope",
        ),
        CheckConstraint("octet_length(content_hash) = 32", name="ck_artifact_content_hash"),
        CheckConstraint(
            "author_source IN ('student','teacher','imported_client')", name="ck_artifact_author"
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    space_id: Mapped[UUID] = mapped_column(index=True)
    artifact_id: Mapped[UUID] = mapped_column()
    parent_revision_id: Mapped[UUID | None] = mapped_column()
    content_hash: Mapped[bytes] = mapped_column(LargeBinary)
    content: Mapped[dict] = mapped_column(JSONB)
    author_source: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class VerificationEvent(Base):
    __tablename__ = "verification_event"
    __table_args__ = (
        ForeignKeyConstraint(
            ["space_id", "artifact_id", "artifact_revision_id"],
            ["artifact_version.space_id", "artifact_version.artifact_id", "artifact_version.id"],
            name="fk_verification_artifact_scope",
        ),
        ForeignKeyConstraint(
            ["objective_id", "course_version_id"],
            ["learning_objective.id", "learning_objective.course_version_id"],
            name="fk_verification_objective_version",
        ),
        CheckConstraint(
            "provenance IN ('server_tool','human_review','client_reported')",
            name="ck_verification_provenance",
        ),
        CheckConstraint("octet_length(artifact_hash) = 32", name="ck_verification_artifact_hash"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    space_id: Mapped[UUID] = mapped_column(index=True)
    artifact_id: Mapped[UUID] = mapped_column()
    artifact_revision_id: Mapped[UUID] = mapped_column()
    objective_id: Mapped[UUID] = mapped_column()
    course_version_id: Mapped[UUID] = mapped_column()
    standard_version: Mapped[str] = mapped_column(String(100))
    artifact_hash: Mapped[bytes] = mapped_column(LargeBinary)
    provenance: Mapped[str] = mapped_column(String(24))
    criteria: Mapped[list] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SyncClaim(Base):
    __tablename__ = "sync_claim"
    __table_args__ = (
        ForeignKeyConstraint(
            ["server_space_id", "expected_account_id"],
            ["learning_space.id", "learning_space.owner_account_id"],
            name="fk_claim_space_owner",
        ),
        CheckConstraint("state = 'committed'", name="ck_claim_state"),
        CheckConstraint("octet_length(manifest_hash) = 32", name="ck_claim_manifest_hash"),
    )
    claim_id: Mapped[UUID] = mapped_column(primary_key=True)
    expected_account_id: Mapped[UUID] = mapped_column(ForeignKey("account.id"))
    origin_local_space_id: Mapped[UUID] = mapped_column(index=True)
    server_space_id: Mapped[UUID] = mapped_column()
    manifest_hash: Mapped[bytes] = mapped_column(LargeBinary)
    state: Mapped[str] = mapped_column(String(16), server_default="committed")
    committed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
