"""Authenticated sync projection for explicitly typed local learning records.

SyncObject is not a platform verification event. Only payloads accepted by the
per-kind Pydantic import schemas enter this projection; all provenance is local.
"""

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
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from vault_backend.models import Base

KINDS_SQL = "('draft','revision','evidence','help','teacher_draft','position')"


class SyncObject(Base):
    __tablename__ = "sync_object"
    __table_args__ = (
        UniqueConstraint("space_id", "server_object_id", name="uq_sync_object_server_scope"),
        CheckConstraint(f"object_type IN {KINDS_SQL}", name="ck_sync_object_type"),
        CheckConstraint("version > 0", name="ck_sync_object_version"),
        CheckConstraint("octet_length(payload_hash) = 32", name="ck_sync_object_hash"),
        CheckConstraint(
            "(deleted_at IS NULL AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object') OR "
            "(deleted_at IS NOT NULL AND payload IS NULL)",
            name="ck_sync_object_payload",
        ),
        CheckConstraint("provenance = 'client_reported'", name="ck_sync_object_provenance"),
    )
    space_id: Mapped[UUID] = mapped_column(ForeignKey("learning_space.id"), primary_key=True)
    object_type: Mapped[str] = mapped_column(String(24), primary_key=True)
    object_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    server_object_id: Mapped[UUID] = mapped_column(unique=True)
    version: Mapped[int] = mapped_column(BigInteger)
    payload_hash: Mapped[bytes] = mapped_column(LargeBinary)
    payload: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    provenance: Mapped[str] = mapped_column(String(24), server_default="client_reported")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SyncOperationReceipt(Base):
    __tablename__ = "sync_operation_receipt"
    __table_args__ = (
        CheckConstraint("octet_length(command_hash) = 32", name="ck_sync_op_hash"),
        CheckConstraint("jsonb_typeof(result) = 'object'", name="ck_sync_op_result"),
    )
    space_id: Mapped[UUID] = mapped_column(ForeignKey("learning_space.id"), primary_key=True)
    op_id: Mapped[UUID] = mapped_column(primary_key=True)
    command_hash: Mapped[bytes] = mapped_column(LargeBinary)
    result: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SyncBatchReceipt(Base):
    __tablename__ = "sync_batch_receipt"
    __table_args__ = (
        CheckConstraint("octet_length(command_hash) = 32", name="ck_sync_batch_hash"),
        CheckConstraint("jsonb_typeof(result) = 'object'", name="ck_sync_batch_result"),
    )
    space_id: Mapped[UUID] = mapped_column(ForeignKey("learning_space.id"), primary_key=True)
    batch_id: Mapped[UUID] = mapped_column(primary_key=True)
    command_hash: Mapped[bytes] = mapped_column(LargeBinary)
    result: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SyncChange(Base):
    __tablename__ = "sync_change"
    __table_args__ = (
        ForeignKeyConstraint(
            ["space_id", "object_type", "object_id"],
            ["sync_object.space_id", "sync_object.object_type", "sync_object.object_id"],
            name="fk_sync_change_object_scope",
        ),
        CheckConstraint("sequence > 0 AND version > 0", name="ck_sync_change_versions"),
        CheckConstraint("octet_length(payload_hash) = 32", name="ck_sync_change_hash"),
        CheckConstraint(
            "(deleted = false AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object') OR "
            "(deleted = true AND payload IS NULL)",
            name="ck_sync_change_payload",
        ),
        CheckConstraint("provenance = 'client_reported'", name="ck_sync_change_provenance"),
    )
    space_id: Mapped[UUID] = mapped_column(primary_key=True)
    sequence: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    object_type: Mapped[str] = mapped_column(String(24))
    object_id: Mapped[str] = mapped_column(String(100))
    server_object_id: Mapped[UUID] = mapped_column()
    version: Mapped[int] = mapped_column(BigInteger)
    payload_hash: Mapped[bytes] = mapped_column(LargeBinary)
    payload: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    deleted: Mapped[bool] = mapped_column()
    provenance: Mapped[str] = mapped_column(String(24), server_default="client_reported")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SyncConflict(Base):
    __tablename__ = "sync_conflict"
    __table_args__ = (
        ForeignKeyConstraint(
            ["space_id", "object_type", "object_id"],
            ["sync_object.space_id", "sync_object.object_type", "sync_object.object_id"],
            name="fk_sync_conflict_object_scope",
        ),
        UniqueConstraint("space_id", "op_id", name="uq_sync_conflict_op"),
        CheckConstraint(
            "base_version >= 0 AND current_version > 0", name="ck_sync_conflict_versions"
        ),
        CheckConstraint("octet_length(payload_hash) = 32", name="ck_sync_conflict_hash"),
        CheckConstraint(
            "jsonb_typeof(incoming_payload) = 'object'", name="ck_sync_conflict_payload"
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    space_id: Mapped[UUID] = mapped_column()
    op_id: Mapped[UUID] = mapped_column()
    object_type: Mapped[str] = mapped_column(String(24))
    object_id: Mapped[str] = mapped_column(String(100))
    base_version: Mapped[int] = mapped_column(BigInteger)
    current_version: Mapped[int] = mapped_column(BigInteger)
    payload_hash: Mapped[bytes] = mapped_column(LargeBinary)
    incoming_payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SyncCursor(Base):
    __tablename__ = "sync_cursor"
    __table_args__ = (
        CheckConstraint("octet_length(token_digest) = 32", name="ck_sync_cursor_digest"),
        CheckConstraint("after_sequence >= 0", name="ck_sync_cursor_sequence"),
        UniqueConstraint("space_id", "after_sequence", name="uq_sync_cursor_watermark"),
        CheckConstraint("length(token_value) = 43", name="ck_sync_cursor_value"),
    )
    token_digest: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    token_value: Mapped[str] = mapped_column(String(43))
    space_id: Mapped[UUID] = mapped_column(ForeignKey("learning_space.id"), index=True)
    after_sequence: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
