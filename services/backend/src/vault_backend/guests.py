import asyncio
import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from vault_backend.checker import canonical_hash, verify_trace, verify_truth_table
from vault_backend.config import Settings
from vault_backend.course_checks.brackets import (
    BRACKET_CONTEXT,
    verify_bracket_judgements,
)
from vault_backend.course_checks.structured_trace import (
    TRUSTED_TRACE_SPECS,
    get_trace_spec,
    verify_structured_trace,
)
from vault_backend.errors import ApiError
from vault_backend.schemas import (
    BracketSubmission,
    OperationInput,
    StructuredTraceSubmission,
    TraceSubmission,
    TruthTableSubmission,
)


def digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


@dataclass
class Operation:
    id: UUID
    request_hash: str
    idempotency_key: UUID
    submission: (
        TraceSubmission
        | TruthTableSubmission
        | StructuredTraceSubmission
        | BracketSubmission
        | None
    )
    kind: str
    state: str = "awaiting_input"
    revision: int = 1
    result: dict[str, Any] | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    sequence: int = 0
    input_keys: dict[UUID, str] = field(default_factory=dict)
    acknowledged: bool = False


@dataclass
class Lease:
    id: UUID
    token_digest: bytes
    origin: str
    created_at: datetime
    idle_expires_at: datetime
    absolute_expires_at: datetime
    operations: dict[UUID, Operation] = field(default_factory=dict)
    operation_keys: dict[UUID, UUID] = field(default_factory=dict)
    stream_ids: set[UUID] = field(default_factory=set)
    agent_requests: int = 0
    agent_results: dict[UUID, tuple[str, dict[str, Any] | None]] = field(default_factory=dict)


class GuestLeaseStore:
    """One-process, bounded RAM only. No DB, disk, broker, telemetry or checkpoint writer."""

    def __init__(
        self,
        settings: Settings,
        now: Callable[[], datetime] | None = None,
        trace_context: dict[str, Any] | None = None,
        logic_context: dict[str, Any] | None = None,
    ):
        self.settings = settings
        self.trace_context = trace_context
        self.logic_context = logic_context
        self.now = now or (lambda: datetime.now(UTC))
        self.leases: dict[UUID, Lease] = {}
        self.nonces: dict[bytes, tuple[str, datetime]] = {}
        self.lock = asyncio.Lock()
        self.active_streams: set[UUID] = set()

    def _prune(self) -> None:
        now = self.now()
        for key, (_, expiry) in list(self.nonces.items()):
            if now >= expiry:
                del self.nonces[key]
        for key, lease in list(self.leases.items()):
            if now >= min(lease.idle_expires_at, lease.absolute_expires_at):
                for op in lease.operations.values():
                    op.submission, op.result = None, None
                    op.events.clear()
                self.active_streams.difference_update(lease.stream_ids)
                lease.stream_ids.clear()
                lease.operations.clear()
                lease.operation_keys.clear()
                del self.leases[key]

    async def prune(self) -> None:
        async with self.lock:
            self._prune()

    async def close(self) -> None:
        async with self.lock:
            self.leases.clear()
            self.nonces.clear()
            self.active_streams.clear()

    def _origin(self, origin: str) -> None:
        if origin not in self.settings.allowed_origins:
            raise ApiError(403, "ORIGIN_REJECTED", "请求来源未获允许。")

    async def nonce(self, origin: str) -> dict[str, str]:
        self._origin(origin)
        async with self.lock:
            self._prune()
            if len(self.nonces) >= self.settings.guest_max_leases * 2:
                raise ApiError(
                    429, "GUEST_CAPACITY_REACHED", "临时服务繁忙，请稍后重试。", retryable=True
                )
            token, expiry = secrets.token_urlsafe(32), self.now() + timedelta(minutes=5)
            self.nonces[digest(token)] = (origin, expiry)
            return {"nonce": token, "expires_at": expiry.isoformat()}

    async def create(self, nonce: str, origin: str) -> dict[str, Any]:
        self._origin(origin)
        if not self.settings.guest_enabled:
            raise ApiError(503, "GUEST_SERVICE_DISABLED", "临时在线核验当前未开放。")
        async with self.lock:
            self._prune()
            entry = self.nonces.pop(digest(nonce), None)
            if not entry or entry[0] != origin:
                raise ApiError(403, "NONCE_INVALID", "预认证凭据已失效，请重新开始。")
            if len(self.leases) >= self.settings.guest_max_leases:
                raise ApiError(
                    429, "GUEST_CAPACITY_REACHED", "临时服务繁忙，请稍后重试。", retryable=True
                )
            token, now = secrets.token_urlsafe(32), self.now()
            lease = Lease(
                uuid4(),
                digest(token),
                origin,
                now,
                now + timedelta(seconds=self.settings.guest_idle_seconds),
                now + timedelta(seconds=self.settings.guest_absolute_seconds),
            )
            self.leases[lease.id] = lease
            return {
                "lease_id": str(lease.id),
                "token": token,
                "created_at": now.isoformat(),
                "idle_expires_at": lease.idle_expires_at.isoformat(),
                "absolute_expires_at": lease.absolute_expires_at.isoformat(),
                "allowed_operations": [
                    *(["verify_trace"] if self.trace_context is not None else []),
                    *(["verify_truth_table"] if self.logic_context is not None else []),
                    *(["verify_structured_trace"] if TRUSTED_TRACE_SPECS else []),
                    "verify_bracket_judgement",
                    *(["learning_assist"] if self.settings.agent_enabled else []),
                ],
                "storage": "ephemeral_memory",
            }

    def _lease(self, lease_id: UUID, token: str, origin: str | None = None) -> Lease:
        self._prune()
        lease = self.leases.get(lease_id)
        if not lease or not secrets.compare_digest(lease.token_digest, digest(token)):
            raise ApiError(401, "GUEST_LEASE_EXPIRED", "临时凭据不可用，请从本地作品重新开始。")
        if origin is not None:
            self._origin(origin)
            if lease.origin != origin:
                raise ApiError(403, "ORIGIN_REJECTED", "请求来源未获允许。")
        return lease

    def _touch(self, lease: Lease) -> None:
        lease.idle_expires_at = min(
            self.now() + timedelta(seconds=self.settings.guest_idle_seconds),
            lease.absolute_expires_at,
        )

    def _operation(self, lease: Lease, operation_id: UUID) -> Operation:
        op = lease.operations.get(operation_id)
        if not op:
            raise ApiError(404, "OPERATION_UNAVAILABLE", "该操作不存在或当前不可访问。")
        return op

    async def begin_assist(
        self, lease_id: UUID, token: str, origin: str, request_id: UUID, payload_hash: str
    ) -> dict[str, Any] | None:
        async with self.lock:
            lease = self._lease(lease_id, token, origin)
            previous = lease.agent_results.get(request_id)
            if previous is not None:
                if previous[0] != payload_hash:
                    raise ApiError(
                        409, "IDEMPOTENCY_CONFLICT", "同一请求标识不能用于不同学习内容。"
                    )
                if previous[1] is None:
                    raise ApiError(
                        409,
                        "ASSIST_IN_PROGRESS",
                        "这条学习请求仍在处理，请稍后重试。",
                        retryable=True,
                    )
                return previous[1]
            if lease.agent_requests >= self.settings.guest_max_agent_requests:
                raise ApiError(429, "AGENT_BUDGET_EXCEEDED", "本次学习会话的助手请求次数已用完。")
            lease.agent_requests += 1
            lease.agent_results[request_id] = (payload_hash, None)
            self._touch(lease)
            return None

    async def complete_assist(
        self,
        lease_id: UUID,
        token: str,
        request_id: UUID,
        payload_hash: str,
        result: dict[str, Any],
    ) -> None:
        async with self.lock:
            lease = self._lease(lease_id, token)
            current = lease.agent_results.get(request_id)
            if current is None or current[0] != payload_hash or current[1] is not None:
                raise ApiError(409, "ASSIST_STATE_CONFLICT", "学习请求状态已变化，请重新发起。")
            lease.agent_results[request_id] = (payload_hash, result)
            self._touch(lease)

    async def fail_assist(
        self, lease_id: UUID, token: str, request_id: UUID, payload_hash: str
    ) -> None:
        async with self.lock:
            lease = self._lease(lease_id, token)
            current = lease.agent_results.get(request_id)
            if current is not None and current[0] == payload_hash and current[1] is None:
                del lease.agent_results[request_id]
                lease.agent_requests = max(0, lease.agent_requests - 1)

    def _snapshot(self, lease: Lease, op: Operation) -> dict[str, Any]:
        return {
            "operation_id": str(op.id),
            "lease_id": str(lease.id),
            "kind": op.kind,
            "status": op.state,
            "revision": str(op.revision),
            "result": op.result,
            "storage": "ephemeral_memory",
            "acknowledged": op.acknowledged,
        }

    def _event(self, lease: Lease, op: Operation, event_type: str) -> None:
        op.sequence += 1
        op.events.append(
            {
                "event_id": str(uuid4()),
                "run_id": str(op.id),
                "sequence": str(op.sequence),
                "occurred_at": self.now().isoformat(),
                "type": event_type,
                "operation": self._snapshot(lease, op),
            }
        )

    def _complete(self, lease: Lease, op: Operation) -> None:
        assert op.submission is not None
        if isinstance(op.submission, StructuredTraceSubmission):
            spec = get_trace_spec(op.submission.activity_version)
            try:
                result = verify_structured_trace(op.submission.model_dump(mode="json"), spec)
            except ValueError as exc:
                raise ApiError(
                    422, "TRACE_SHAPE_INVALID", "提交的轨迹步数或字段与活动操作序列不一致。"
                ) from exc
            context = spec.context
        elif isinstance(op.submission, BracketSubmission):
            try:
                result = verify_bracket_judgements(op.submission.model_dump(mode="json"))
            except ValueError as exc:
                raise ApiError(
                    422, "BRACKET_SHAPE_INVALID", "提交的判定用例集合或顺序与活动固定用例不一致。"
                ) from exc
            context = BRACKET_CONTEXT
        elif isinstance(op.submission, TraceSubmission):
            result = verify_trace(op.submission)
            context = self.trace_context
        else:
            result = verify_truth_table(op.submission)
            context = self.logic_context
        result["verification_id"] = str(uuid4())
        assert context is not None
        result.update(context)
        op.result, op.state = result, "completed"
        op.submission = None
        self._event(lease, op, "verification.completed")

    async def start(
        self,
        lease_id: UUID,
        token: str,
        origin: str,
        key: UUID,
        submission: (
            TraceSubmission
            | TruthTableSubmission
            | StructuredTraceSubmission
            | BracketSubmission
        ),
    ) -> dict[str, Any]:
        async with self.lock:
            lease = self._lease(lease_id, token, origin)
            if isinstance(submission, (StructuredTraceSubmission, BracketSubmission)):
                context: dict[str, Any] | None = {"available": True}
            elif isinstance(submission, TraceSubmission):
                context = self.trace_context
            else:
                context = self.logic_context
            if context is None:
                raise ApiError(503, "COURSE_CONTENT_UNAVAILABLE", "课程活动或检查器版本尚未就绪。")
            request_hash = canonical_hash(submission.model_dump(mode="json"))
            previous_id = lease.operation_keys.get(key)
            if previous_id is not None:
                previous = lease.operations[previous_id]
                if previous.request_hash != request_hash:
                    raise ApiError(409, "IDEMPOTENCY_CONFLICT", "同一幂等键不能用于不同作品。")
                return self._snapshot(lease, previous)
            if len(lease.operations) >= self.settings.guest_max_operations:
                raise ApiError(429, "GUEST_BUDGET_EXCEEDED", "本次临时租约的核验次数已用完。")
            op = Operation(uuid4(), request_hash, key, submission, submission.kind)
            lease.operations[op.id], lease.operation_keys[key] = op, op.id
            self._touch(lease)
            if (
                isinstance(
                    submission,
                    (TruthTableSubmission, StructuredTraceSubmission, BracketSubmission),
                )
                or submission.trace is not None
            ):
                self._complete(lease, op)
            else:
                self._event(lease, op, "student.input_required")
            return self._snapshot(lease, op)

    async def snapshot(self, lease_id: UUID, token: str, operation_id: UUID) -> dict[str, Any]:
        async with self.lock:
            lease = self._lease(lease_id, token)
            return self._snapshot(lease, self._operation(lease, operation_id))

    async def input(
        self, lease_id: UUID, token: str, origin: str, operation_id: UUID, body: OperationInput
    ) -> dict[str, Any]:
        async with self.lock:
            lease = self._lease(lease_id, token, origin)
            op = self._operation(lease, operation_id)
            payload_hash = canonical_hash(body.model_dump(mode="json"))
            previous = op.input_keys.get(body.op_id)
            if previous is not None:
                if previous != payload_hash:
                    raise ApiError(409, "IDEMPOTENCY_CONFLICT", "同一输入标识对应了不同内容。")
                return self._snapshot(lease, op)
            if op.state != "awaiting_input":
                raise ApiError(409, "OPERATION_NOT_WAITING", "该操作不再接受输入。")
            if body.expected_revision != str(op.revision):
                raise ApiError(412, "REVISION_CONFLICT", "操作版本已变化。")
            assert op.submission is not None
            assert isinstance(op.submission, TraceSubmission)
            op.submission = op.submission.model_copy(
                update={
                    "trace": body.trace,
                    "explanation": body.explanation,
                }
            )
            op.input_keys[body.op_id] = payload_hash
            op.revision += 1
            self._touch(lease)
            self._complete(lease, op)
            return self._snapshot(lease, op)

    async def cancel(
        self, lease_id: UUID, token: str, origin: str, operation_id: UUID, expected_revision: str
    ) -> dict[str, Any]:
        async with self.lock:
            lease = self._lease(lease_id, token, origin)
            op = self._operation(lease, operation_id)
            if op.state in {"cancelled", "completed", "acknowledged"}:
                return self._snapshot(lease, op)
            if expected_revision != str(op.revision):
                raise ApiError(412, "REVISION_CONFLICT", "操作版本已变化。")
            op.submission, op.result = None, None
            op.state, op.revision = "cancelled", op.revision + 1
            self._event(lease, op, "operation.cancelled")
            return self._snapshot(lease, op)

    async def ack(
        self, lease_id: UUID, token: str, origin: str, operation_id: UUID, expected_revision: str
    ) -> dict[str, Any]:
        async with self.lock:
            lease = self._lease(lease_id, token, origin)
            op = self._operation(lease, operation_id)
            if op.acknowledged:
                return self._snapshot(lease, op)
            if op.state not in {"completed", "cancelled"}:
                raise ApiError(409, "OPERATION_NOT_TERMINAL", "请先完成或取消操作。")
            if expected_revision != str(op.revision):
                raise ApiError(412, "REVISION_CONFLICT", "操作版本已变化。")
            op.submission, op.result = None, None
            op.events.clear()
            op.acknowledged, op.state = True, "acknowledged"
            op.revision += 1
            self._event(lease, op, "operation.acknowledged")
            return self._snapshot(lease, op)

    async def events(
        self, lease_id: UUID, token: str, operation_id: UUID, cursor: int
    ) -> tuple[list[dict[str, Any]], bool]:
        async with self.lock:
            lease = self._lease(lease_id, token)
            op = self._operation(lease, operation_id)
            if cursor > op.sequence:
                raise ApiError(400, "EVENT_CURSOR_INVALID", "事件游标超出了当前操作。")
            if op.events and cursor < int(op.events[0]["sequence"]) - 1:
                raise ApiError(410, "EVENT_CURSOR_EXPIRED", "事件窗口已清理，请读取当前操作状态。")
            events = [event for event in op.events if int(event["sequence"]) > cursor]
            terminal = op.state in {"completed", "cancelled", "acknowledged"}
            return events, terminal

    async def acquire_stream(self, lease_id: UUID, token: str, operation_id: UUID) -> UUID:
        async with self.lock:
            lease = self._lease(lease_id, token)
            self._operation(lease, operation_id)
            if (
                len(lease.stream_ids) >= self.settings.guest_streams_per_lease
                or len(self.active_streams) >= self.settings.guest_max_streams
            ):
                raise ApiError(429, "GUEST_STREAM_LIMIT", "在线进度连接数量已达到限制。")
            stream_id = uuid4()
            lease.stream_ids.add(stream_id)
            self.active_streams.add(stream_id)
            return stream_id

    async def release_stream(self, lease_id: UUID, stream_id: UUID) -> None:
        async with self.lock:
            self.active_streams.discard(stream_id)
            lease = self.leases.get(lease_id)
            if lease is not None:
                lease.stream_ids.discard(stream_id)
