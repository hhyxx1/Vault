"""Claim ownership once, then synchronize bounded client learning reports.

Every write runs inside the auth service's locked identity transaction. The space
row serializes object versions and its durable change order. Neither a local
clock nor a claimed checker result can become platform authority.
"""

import hashlib
import json
import secrets
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4, uuid5

from fastapi import APIRouter, Header, Query, Request
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from vault_backend.auth import authorized_transaction
from vault_backend.errors import ApiError
from vault_backend.models import LearningSpace, SyncClaim
from vault_backend.schemas import TraceStep
from vault_backend.sync_models import (
    SyncBatchReceipt,
    SyncChange,
    SyncConflict,
    SyncCursor,
    SyncObject,
    SyncOperationReceipt,
)
from vault_backend.sync_schemas import (
    PAYLOAD_MODELS,
    BatchRequest,
    BatchResponse,
    ChangeResponse,
    ChangesResponse,
    ClaimRequest,
    ClaimResponse,
    ConflictResponse,
    ConflictsResponse,
    EvidencePayload,
    OperationResult,
    PersonalAssistPayload,
    PersonalAttemptPayload,
    PersonalCoursePayload,
    PersonalCourseVersionPayload,
    RevisionPayload,
    SpaceResponse,
    SpacesResponse,
    SyncOperation,
    TombstonePayload,
)

router = APIRouter(prefix="/api/v1/sync", tags=["Account sync"])


def payload_hash(payload: dict) -> str:
    raw = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def require_key(value: str | None, expected: UUID) -> None:
    try:
        valid = UUID(value or "") == expected
    except ValueError:
        valid = False
    if not valid:
        raise ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "幂等键必须与本次固定请求 ID 一致。")


def require_account(actual: UUID, expected: UUID) -> None:
    if actual != expected:
        raise ApiError(409, "ACCOUNT_CHANGED", "账号已变化，请保留原账号的待同步记录。")


def claim_response(claim: SyncClaim) -> ClaimResponse:
    return ClaimResponse(
        claim_id=claim.claim_id,
        expected_account_id=claim.expected_account_id,
        origin_local_space_id=claim.origin_local_space_id,
        manifest_hash=claim.manifest_hash.hex(),
        server_space_id=claim.server_space_id,
        committed_at=claim.committed_at,
    )


async def advisory_claim_locks(session: AsyncSession, claim_id: UUID, origin: UUID) -> None:
    # Locks are global, because RLS deliberately hides another account's mapping.
    # One fixed order avoids cross-account claim/origin lock inversion.
    for key in sorted((f"claim:{claim_id}", f"origin:{origin}")):
        await session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": key}
        )


async def own_space(
    session: AsyncSession, owner: UUID, space_id: UUID, *, lock: bool = False
) -> LearningSpace:
    query = select(LearningSpace).where(
        LearningSpace.id == space_id,
        LearningSpace.owner_account_id == owner,
        LearningSpace.kind == "personal",
        LearningSpace.deleted_at.is_(None),
        LearningSpace.origin_local_id.is_not(None),
    )
    if lock:
        query = query.with_for_update()
    space = await session.scalar(query)
    if space is None:
        raise ApiError(404, "SPACE_UNAVAILABLE", "该学习空间不存在或不可用。")
    return space


@router.post("/claims", response_model=ClaimResponse, operation_id="claimLocalSpace")
async def claim_local_space(
    request: Request,
    body: ClaimRequest,
    idempotency_key: Annotated[str | None, Header()] = None,
):
    require_key(idempotency_key, body.claim_id)
    async with authorized_transaction(request, write=True) as (session, principal):
        require_account(principal.account_id, body.expected_account_id)
        await advisory_claim_locks(session, body.claim_id, body.origin_local_space_id)
        existing = await session.scalar(
            select(SyncClaim).where(
                SyncClaim.claim_id == body.claim_id,
                SyncClaim.expected_account_id == principal.account_id,
            )
        )
        if existing is not None:
            if (
                existing.origin_local_space_id != body.origin_local_space_id
                or existing.manifest_hash.hex() != body.manifest_hash
            ):
                raise ApiError(409, "IDEMPOTENCY_CONFLICT", "该关联请求已固定为另一份本地快照。")
            return claim_response(existing)
        space = await session.scalar(
            select(LearningSpace).where(
                LearningSpace.origin_local_id == body.origin_local_space_id,
                LearningSpace.owner_account_id == principal.account_id,
            )
        )
        if space is not None and (space.deleted_at is not None or space.kind != "personal"):
            raise ApiError(409, "ORIGIN_UNAVAILABLE", "该本地空间已固定归属，无法重新关联。")
        if space is None:
            space_id = uuid4()
            created_id = await session.scalar(
                insert(LearningSpace)
                .values(
                    id=space_id,
                    owner_account_id=principal.account_id,
                    origin_local_id=body.origin_local_space_id,
                    kind="personal",
                )
                .on_conflict_do_nothing(index_elements=[LearningSpace.origin_local_id])
                .returning(LearningSpace.id)
            )
            if created_id is None:
                # Do not disclose the bound owner's ID or space name.
                raise ApiError(409, "ORIGIN_UNAVAILABLE", "该本地空间已固定归属，无法重新关联。")
            space = await session.get(LearningSpace, created_id)
        inserted = await session.scalar(
            insert(SyncClaim)
            .values(
                claim_id=body.claim_id,
                expected_account_id=principal.account_id,
                origin_local_space_id=body.origin_local_space_id,
                server_space_id=space.id,
                manifest_hash=bytes.fromhex(body.manifest_hash),
            )
            .on_conflict_do_nothing(index_elements=[SyncClaim.claim_id])
            .returning(SyncClaim.claim_id)
        )
        if inserted is None:
            # Other accounts' claim IDs remain indistinguishable from unavailable.
            raise ApiError(409, "CLAIM_UNAVAILABLE", "该关联请求不可用，请保留原待关联记录。")
        result = await session.get(SyncClaim, inserted)
        return claim_response(result)


@router.get("/claims/{claim_id}", response_model=ClaimResponse, operation_id="recoverLocalClaim")
async def recover_claim(request: Request, claim_id: UUID):
    async with authorized_transaction(request, write=False) as (session, principal):
        result = await session.scalar(
            select(SyncClaim).where(
                SyncClaim.claim_id == claim_id,
                SyncClaim.expected_account_id == principal.account_id,
            )
        )
        if result is None:
            raise ApiError(404, "CLAIM_UNAVAILABLE", "该关联结果不存在或不可见。")
        return claim_response(result)


@router.get("/spaces", response_model=SpacesResponse, operation_id="listSyncSpaces")
async def list_spaces(request: Request):
    async with authorized_transaction(request, write=False) as (session, principal):
        spaces = (
            await session.scalars(
                select(LearningSpace)
                .where(
                    LearningSpace.owner_account_id == principal.account_id,
                    LearningSpace.kind == "personal",
                    LearningSpace.deleted_at.is_(None),
                    LearningSpace.origin_local_id.is_not(None),
                )
                .order_by(LearningSpace.bound_at, LearningSpace.id)
                .limit(200)
            )
        ).all()
        return SpacesResponse(
            spaces=[
                SpaceResponse(
                    space_id=space.id,
                    origin_local_space_id=space.origin_local_id,
                    kind="personal",
                    bound_at=space.bound_at,
                    version=str(space.version),
                )
                for space in spaces
            ]
        )


def operation_result(op: SyncOperation, status: str, version: int = 0, **kwargs):
    return OperationResult(
        op_id=op.op_id,
        object_type=op.object_type,
        object_id=op.object_id,
        status=status,
        current_version=str(version),
        **kwargs,
    )


def validate_payload(op: SyncOperation, origin: UUID):
    if op.payload == {"deleted": True}:
        # Literal True also accepts 1 in Pydantic; the raw check above alone is not
        # enough, so require the actual boolean before accepting a tombstone.
        if op.payload["deleted"] is not True:
            return None, "INVALID_PAYLOAD"
        return TombstonePayload.model_validate(op.payload), None
    try:
        model = PAYLOAD_MODELS[op.object_type].model_validate(op.payload)
    except (ValidationError, KeyError, ValueError):
        return None, "INVALID_PAYLOAD"
    if model.spaceId != origin:
        return None, "SOURCE_SPACE_MISMATCH"
    key = model.revisionId if isinstance(model, RevisionPayload) else model.id
    if str(key) != op.object_id:
        return None, "SOURCE_OBJECT_MISMATCH"
    return model, None


async def dependencies(session: AsyncSession, space: LearningSpace, model) -> str | None:
    if isinstance(model, PersonalAssistPayload):
        attempt = await session.get(
            SyncObject, (space.id, "personal_attempt", str(model.attemptId))
        )
        if attempt is None:
            return "PERSONAL_ATTEMPT_NOT_SYNCED"
        if (
            attempt.deleted_at is not None
            or attempt.payload is None
            or attempt.payload["courseId"] != str(model.courseId)
            or attempt.payload["scopeVersionId"] != str(model.scopeVersionId)
            or attempt.payload["topicId"] != str(model.topicId)
        ):
            return "PERSONAL_ASSIST_REFERENCE_MISMATCH"
        return None
    if isinstance(model, PersonalCourseVersionPayload):
        course = await session.get(SyncObject, (space.id, "personal_course", str(model.courseId)))
        if course is None:
            return "PERSONAL_COURSE_NOT_SYNCED"
        if course.deleted_at is not None or course.payload is None:
            return "PERSONAL_COURSE_DELETED"
        versions = await session.scalars(
            select(SyncObject).where(
                SyncObject.space_id == space.id,
                SyncObject.object_type == "personal_course_version",
                SyncObject.object_id != str(model.id),
            )
        )
        if any(
            row.payload
            and row.payload.get("courseId") == str(model.courseId)
            and row.payload.get("version") == model.version
            for row in versions
        ):
            return "PERSONAL_COURSE_VERSION_CONFLICT"
        return None
    if isinstance(model, PersonalAttemptPayload):
        course = await session.get(SyncObject, (space.id, "personal_course", str(model.courseId)))
        if course is None:
            return "PERSONAL_COURSE_NOT_SYNCED"
        if course.deleted_at is not None or course.payload is None:
            return "PERSONAL_COURSE_DELETED"
        if model.scopeVersionId:
            scope = await session.get(
                SyncObject,
                (space.id, "personal_course_version", str(model.scopeVersionId)),
            )
            if scope is None:
                return "PERSONAL_COURSE_VERSION_NOT_SYNCED"
            if (
                scope.deleted_at is not None
                or scope.payload is None
                or scope.payload["courseId"] != str(model.courseId)
                or str(model.topicId) not in {topic["id"] for topic in scope.payload["topics"]}
            ):
                return "PERSONAL_COURSE_VERSION_MISMATCH"
            return None
        if str(model.topicId) not in {topic["id"] for topic in course.payload["topics"]}:
            return "PERSONAL_TOPIC_MISMATCH"
        return None
    if not isinstance(model, EvidencePayload):
        return None
    revision = await session.get(SyncObject, (space.id, "revision", str(model.revisionId)))
    if revision is None:
        return "REVISION_NOT_SYNCED"
    if revision.deleted_at is not None or revision.payload is None:
        return "REVISION_DELETED"
    payload = revision.payload
    if (
        str(model.result.client_revision_id) != str(model.revisionId)
        or str(model.result.client_artifact_id) != payload["artifactId"]
        or model.revisionVersion != payload["version"]
        or model.objectiveId != payload["id"]
    ):
        return "EVIDENCE_REVISION_MISMATCH"
    submitted = model.submittedWork.model_dump(mode="json")
    if payload["explanation"] != submitted["explanation"]:
        return "EVIDENCE_CONTENT_MISMATCH"
    # Check the import's content binding, not the truth of its claimed checker result.
    try:
        expected_trace = [
            {
                "after_stack": json.loads(row["stack"]),
                "output": None if row["output"].strip() in {"", "null"} else int(row["output"]),
                "underflow": row["underflow"],
            }
            for row in payload["trace"]
        ]
        expected_trace = [
            TraceStep.model_validate(row).model_dump(mode="json") for row in expected_trace
        ]
    except (ValueError, TypeError):
        return "EVIDENCE_CONTENT_MISMATCH"
    if expected_trace != submitted["trace"]:
        return "EVIDENCE_CONTENT_MISMATCH"
    expected_hash = payload_hash({"kind": "stack_trace_with_explanation", **submitted})
    if model.result.artifact_hash != expected_hash:
        return "EVIDENCE_CONTENT_MISMATCH"
    for key in model.helpEventIds:
        help_record = await session.get(SyncObject, (space.id, "help", str(key)))
        if help_record is None:
            return "HELP_NOT_SYNCED"
        if (
            help_record.deleted_at is not None
            or help_record.payload["objectiveId"] != model.objectiveId
        ):
            return "HELP_REFERENCE_MISMATCH"
    return None


async def remember_result(session: AsyncSession, space_id: UUID, op: SyncOperation, result):
    session.add(
        SyncOperationReceipt(
            space_id=space_id,
            op_id=op.op_id,
            command_hash=bytes.fromhex(payload_hash(op.model_dump(mode="json"))),
            result=result.model_dump(mode="json"),
        )
    )
    await session.flush()
    return result


async def apply_operation(session, space, principal, op):
    command_hash = bytes.fromhex(payload_hash(op.model_dump(mode="json")))
    receipt = await session.get(SyncOperationReceipt, (space.id, op.op_id))
    if receipt is not None:
        if receipt.command_hash != command_hash:
            return operation_result(op, "rejected", reason="OP_IDEMPOTENCY_CONFLICT")
        result = OperationResult.model_validate(receipt.result)
        if result.status == "applied":
            result.status = "already_applied"
        return result
    if op.object_type == "attachment":
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", reason="ATTACHMENT_UNSUPPORTED"),
        )
    if op.object_type == "teacher_draft" and principal.account_type != "teacher":
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", reason="TEACHER_ACCOUNT_REQUIRED"),
        )
    try:
        matches = payload_hash(op.payload) == op.payload_hash
    except (ValueError, TypeError, RecursionError):
        matches = False
    if not matches:
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", reason="PAYLOAD_HASH_MISMATCH"),
        )
    if op.object_type in {
        "personal_course",
        "personal_course_version",
        "personal_attempt",
        "personal_assist",
        "course_attempt",
        "structured_attempt",
    } and op.payload == {"deleted": True}:
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", reason="PERSONAL_RECORD_DELETE_UNSUPPORTED"),
        )
    model, invalid = validate_payload(op, space.origin_local_id)
    if invalid:
        return await remember_result(
            session, space.id, op, operation_result(op, "rejected", reason=invalid)
        )
    obj = await session.get(SyncObject, (space.id, op.object_type, op.object_id))
    current_version = obj.version if obj is not None else 0
    deleted = isinstance(model, TombstonePayload)
    if obj is None and isinstance(model, PersonalAttemptPayload) and model.scopeVersionId is None:
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", reason="PERSONAL_COURSE_VERSION_REQUIRED"),
        )
    if obj is not None and obj.deleted_at is not None:
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", current_version, reason="OBJECT_DELETED"),
        )
    if obj is not None and op.object_type in {"course_attempt", "structured_attempt"} and not deleted:
        previous = obj.payload or {}
        identity = (
            "id", "spaceId", "artifactId", "objectiveId", "courseCode",
            "activityVersion", "createdAt", "objectiveCode", "kind",
        )
        if (
            previous.get("result") is not None
            or any(previous.get(key) != op.payload.get(key) for key in identity)
            or (
                previous.get("submittedAt") is not None
                and any(
                    previous.get(key) != op.payload.get(key)
                    for key in ("rows", "traceRows", "bracketRows", "explanation", "submittedAt")
                )
            )
        ):
            return await remember_result(
                session, space.id, op,
                operation_result(op, "rejected", current_version, reason="COURSE_ATTEMPT_LOCKED"),
            )
    if int(op.base_version) != current_version:
        if obj is None:
            return operation_result(op, "dependency_pending", reason="BASE_OBJECT_NOT_SYNCED")
        branch = SyncConflict(
            id=uuid4(),
            space_id=space.id,
            op_id=op.op_id,
            object_type=op.object_type,
            object_id=op.object_id,
            base_version=int(op.base_version),
            current_version=current_version,
            payload_hash=bytes.fromhex(op.payload_hash),
            incoming_payload=op.payload,
        )
        session.add(branch)
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(
                op,
                "conflict",
                current_version,
                reason="VERSION_CONFLICT",
                conflict_id=branch.id,
            ),
        )
    if (
        obj is not None
        and op.object_type
        in {
            "revision",
            "evidence",
            "help",
            "personal_course_version",
            "personal_attempt",
            "personal_assist",
        }
        and not deleted
    ):
        return await remember_result(
            session,
            space.id,
            op,
            operation_result(op, "rejected", current_version, reason="IMMUTABLE_HISTORY"),
        )
    if obj is not None and isinstance(model, PersonalCoursePayload):
        old_topics = {topic["id"]: topic for topic in obj.payload["topics"]}
        new_topics = {str(topic.id): topic.model_dump(mode="json") for topic in model.topics}
        if obj.payload["createdAt"] != model.createdAt or any(
            new_topics.get(topic_id) != old_topic for topic_id, old_topic in old_topics.items()
        ):
            return await remember_result(
                session,
                space.id,
                op,
                operation_result(
                    op, "rejected", current_version, reason="PERSONAL_COURSE_IDENTITY_MISMATCH"
                ),
            )
    if not deleted:
        pending = await dependencies(session, space, model)
        if pending:
            status = (
                "dependency_pending"
                if pending
                in {
                    "REVISION_NOT_SYNCED",
                    "HELP_NOT_SYNCED",
                    "PERSONAL_COURSE_NOT_SYNCED",
                    "PERSONAL_COURSE_VERSION_NOT_SYNCED",
                    "PERSONAL_ATTEMPT_NOT_SYNCED",
                }
                else "rejected"
            )
            result = operation_result(op, status, current_version, reason=pending)
            if status == "dependency_pending":
                # No op receipt: after the prerequisite arrives the same stable
                # op can succeed in a new batch. A saved batch still replays exactly.
                return result
            return await remember_result(session, space.id, op, result)
    now = datetime.now(UTC)
    next_version = current_version + 1
    if obj is None:
        obj = SyncObject(
            space_id=space.id,
            object_type=op.object_type,
            object_id=op.object_id,
            server_object_id=uuid5(space.id, f"{op.object_type}:{op.object_id}"),
            version=next_version,
            payload_hash=bytes.fromhex(op.payload_hash),
            payload=None if deleted else op.payload,
            deleted_at=now if deleted else None,
            updated_at=now,
        )
        session.add(obj)
    else:
        obj.version = next_version
        obj.payload_hash = bytes.fromhex(op.payload_hash)
        obj.payload = None if deleted else op.payload
        obj.deleted_at = now if deleted else None
        obj.updated_at = now
    await session.flush()
    sequence = (
        await session.scalar(
            select(func.coalesce(func.max(SyncChange.sequence), 0)).where(
                SyncChange.space_id == space.id
            )
        )
    ) + 1
    session.add(
        SyncChange(
            space_id=space.id,
            sequence=sequence,
            object_type=op.object_type,
            object_id=op.object_id,
            server_object_id=obj.server_object_id,
            version=next_version,
            payload_hash=bytes.fromhex(op.payload_hash),
            payload=None if deleted else op.payload,
            deleted=deleted,
        )
    )
    space.version += 1
    return await remember_result(
        session, space.id, op, operation_result(op, "applied", next_version)
    )


@router.post(
    "/spaces/{space_id}/batches", response_model=BatchResponse, operation_id="syncLocalBatch"
)
async def sync_batch(
    request: Request,
    space_id: UUID,
    body: BatchRequest,
    idempotency_key: Annotated[str | None, Header()] = None,
):
    require_key(idempotency_key, body.batch_id)
    async with authorized_transaction(request, write=True) as (session, principal):
        require_account(principal.account_id, body.expected_account_id)
        space = await own_space(session, principal.account_id, space_id, lock=True)
        command_hash = bytes.fromhex(payload_hash(body.model_dump(mode="json")))
        saved = await session.get(SyncBatchReceipt, (space.id, body.batch_id))
        if saved is not None:
            if saved.command_hash != command_hash:
                raise ApiError(409, "IDEMPOTENCY_CONFLICT", "该同步批次已固定为另一份内容。")
            response = BatchResponse.model_validate(saved.result)
            for result in response.results:
                if result.status == "applied":
                    result.status = "already_applied"
            return response
        results = []
        for op in body.operations:
            results.append(await apply_operation(session, space, principal, op))
        response = BatchResponse(batch_id=body.batch_id, space_id=space.id, results=results)
        session.add(
            SyncBatchReceipt(
                space_id=space.id,
                batch_id=body.batch_id,
                command_hash=command_hash,
                result=response.model_dump(mode="json"),
            )
        )
        await session.flush()
        return response


@router.get(
    "/spaces/{space_id}/changes", response_model=ChangesResponse, operation_id="readSyncChanges"
)
async def read_changes(
    request: Request,
    space_id: UUID,
    cursor: Annotated[str | None, Query(min_length=32, max_length=128)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    async with authorized_transaction(request, write=False) as (session, principal):
        space = await own_space(session, principal.account_id, space_id, lock=True)
        after = 0
        if cursor:
            record = await session.get(SyncCursor, hashlib.sha256(cursor.encode()).digest())
            if record is None or record.space_id != space.id:
                raise ApiError(400, "SYNC_CURSOR_INVALID", "该同步游标不属于当前空间或不可用。")
            after = record.after_sequence
        rows = (
            await session.scalars(
                select(SyncChange)
                .where(SyncChange.space_id == space.id, SyncChange.sequence > after)
                .order_by(SyncChange.sequence)
                .limit(limit + 1)
            )
        ).all()
        selected = rows[:limit]
        next_after = selected[-1].sequence if selected else after
        if cursor and next_after == after:
            next_cursor = cursor
        else:
            same_watermark = await session.scalar(
                select(SyncCursor).where(
                    SyncCursor.space_id == space.id,
                    SyncCursor.after_sequence == next_after,
                )
            )
            if same_watermark is not None:
                next_cursor = same_watermark.token_value
            else:
                next_cursor = secrets.token_urlsafe(32)
                session.add(
                    SyncCursor(
                        token_digest=hashlib.sha256(next_cursor.encode()).digest(),
                        token_value=next_cursor,
                        space_id=space.id,
                        after_sequence=next_after,
                    )
                )
                await session.flush()
        return ChangesResponse(
            space_id=space.id,
            changes=[
                ChangeResponse(
                    sequence=str(row.sequence),
                    object_type=row.object_type,
                    object_id=row.object_id,
                    server_object_id=row.server_object_id,
                    version=str(row.version),
                    deleted=row.deleted,
                    payload=row.payload,
                    payload_hash=row.payload_hash.hex(),
                    requires_review=row.object_type in {"evidence", "course_attempt", "structured_attempt"},
                )
                for row in selected
            ],
            next_cursor=next_cursor,
            has_more=len(rows) > limit,
        )


@router.get(
    "/spaces/{space_id}/conflicts",
    response_model=ConflictsResponse,
    operation_id="readSyncConflicts",
)
async def read_conflicts(
    request: Request,
    space_id: UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    async with authorized_transaction(request, write=False) as (session, principal):
        await own_space(session, principal.account_id, space_id)
        rows = (
            await session.scalars(
                select(SyncConflict)
                .where(SyncConflict.space_id == space_id)
                .order_by(SyncConflict.created_at.desc(), SyncConflict.id)
                .limit(limit)
            )
        ).all()
        return ConflictsResponse(
            space_id=space_id,
            conflicts=[
                ConflictResponse(
                    conflict_id=row.id,
                    object_type=row.object_type,
                    object_id=row.object_id,
                    base_version=str(row.base_version),
                    current_version=str(row.current_version),
                    incoming_payload=row.incoming_payload,
                    payload_hash=row.payload_hash.hex(),
                    created_at=row.created_at,
                )
                for row in rows
            ],
        )
