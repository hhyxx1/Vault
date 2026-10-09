import asyncio
import contextlib
import json
from contextlib import asynccontextmanager
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncEngine

from vault_backend import __version__
from vault_backend.agent_gateway import ModelRouter
from vault_backend.auth import AuthService
from vault_backend.auth import router as auth_router
from vault_backend.checker import canonical_hash
from vault_backend.config import Settings
from vault_backend.content import CourseRepository
from vault_backend.db import create_engine, database_ready
from vault_backend.errors import ApiError
from vault_backend.guests import GuestLeaseStore
from vault_backend.learning_assist import LearningAssistWorkflow
from vault_backend.learning_assist_schemas import (
    LearningAssistReply,
    LearningAssistRequest,
    PersonalLearningAssistRequest,
)
from vault_backend.model_profiles import PublicModelCatalog
from vault_backend.responses import CourseCatalog, LeaseResponse, NonceResponse, OperationResponse
from vault_backend.schemas import (
    LeaseRequest,
    OperationInput,
    RevisionCommand,
    TraceSubmission,
    TruthTableSubmission,
)
from vault_backend.sync import router as sync_router


def error_response(request: Request, error: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={
            "code": error.code,
            "message": error.message,
            "request_id": getattr(request.state, "request_id", str(uuid4())),
            "retryable": error.retryable,
            "details": error.details,
        },
    )


def credential(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("GuestLease "):
        raise ApiError(401, "GUEST_LEASE_REQUIRED", "请先建立临时在线核验会话。")
    token = authorization[11:]
    if not 32 <= len(token) <= 128 or any(c.isspace() for c in token):
        raise ApiError(401, "GUEST_LEASE_EXPIRED", "临时凭据不可用，请从本地作品重新开始。")
    return token


def mutation_origin(request: Request) -> str:
    origin = request.headers.get("origin")
    if not origin:
        raise ApiError(403, "ORIGIN_REQUIRED", "写操作需要同源来源信息。")
    return origin


def create_app(
    settings: Settings | None = None,
    store: GuestLeaseStore | None = None,
    assist_runner: Any | None = None,
) -> FastAPI:
    settings = settings or Settings()
    content = CourseRepository(settings.course_catalog_path)
    store = store or GuestLeaseStore(
        settings, trace_context=content.trace_context, logic_context=content.logic_context
    )
    if settings.agent_enabled and assist_runner is None:
        assist_runner = LearningAssistWorkflow(ModelRouter.from_settings(settings))
    engine: AsyncEngine | None = (
        create_engine(settings.database_url) if settings.database_url else None
    )

    async def cleanup():
        while True:
            await asyncio.sleep(1)
            await store.prune()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        cleaner = asyncio.create_task(cleanup())
        try:
            yield
        finally:
            cleaner.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await cleaner
            await store.close()
            if assist_runner is not None and hasattr(assist_runner, "close"):
                await assist_runner.close()
            if engine is not None:
                await engine.dispose()

    app = FastAPI(
        title="穹隆 API",
        version=__version__,
        lifespan=lifespan,
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
    )
    app.state.settings, app.state.guest_store, app.state.engine = settings, store, engine
    app.state.agent = assist_runner
    app.state.auth = AuthService(engine, settings)
    app.include_router(auth_router)
    app.include_router(sync_router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "Last-Event-ID",
            "X-CSRF-Token",
            "X-Request-ID",
        ],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        supplied = request.headers.get("x-request-id", "")
        try:
            request.state.request_id = str(UUID(supplied))
        except ValueError:
            request.state.request_id = str(uuid4())
        if request.method in {"POST", "PUT", "PATCH"}:
            # Read incrementally, rejecting before accumulating an unbounded chunked body.
            chunks, total = [], 0
            async for chunk in request.stream():
                total += len(chunk)
                if total > settings.max_request_bytes:
                    return error_response(
                        request, ApiError(413, "PAYLOAD_TOO_LARGE", "提交内容超出限制。")
                    )
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(ApiError)
    async def api_error(request: Request, error: ApiError):
        return error_response(request, error)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # Pydantic error 'input' can contain credentials or student work. Do not return it.
        details = {
            "fields": [
                {"path": ".".join(map(str, item["loc"])), "type": item["type"]}
                for item in error.errors()
            ]
        }
        return error_response(
            request, ApiError(422, "VALIDATION_ERROR", "提交字段不符合接口要求。", details=details)
        )

    @app.exception_handler(Exception)
    async def unknown_error(request: Request, error: Exception):
        return error_response(
            request,
            ApiError(500, "INTERNAL_ERROR", "服务未完成请求，请保留本地作品。", retryable=True),
        )

    @app.get("/api/v1/health/live", tags=["Health"])
    async def live():
        return {"status": "alive", "version": __version__}

    @app.get("/api/v1/health/ready", tags=["Health"])
    async def ready():
        ready = await database_ready(engine)
        return JSONResponse(
            status_code=200 if ready else 503,
            content={
                "status": "ready" if ready else "partial",
                "database": "ready" if ready else "unavailable",
                "features": {
                    "guest_trace": settings.guest_enabled and content.trace_context is not None,
                    "guest_truth_table": (
                        settings.guest_enabled and content.logic_context is not None
                    ),
                    "accounts": ready and settings.auth_enabled,
                    "sync": ready and settings.auth_enabled,
                    "agent": settings.agent_enabled and assist_runner is not None,
                    "isolated_execution": False,
                    "rag": False,
                },
            },
        )

    @app.get("/api/v1/courses", tags=["Courses"], response_model=CourseCatalog)
    async def courses():
        return content.get_catalog()

    @app.get("/api/v1/model-profiles", tags=["Learning"], response_model=PublicModelCatalog)
    async def model_profiles():
        agent = app.state.agent
        if not settings.agent_enabled or agent is None:
            return PublicModelCatalog(profiles=[], task_defaults={})
        gateway = getattr(agent, "gateway", None)
        if not isinstance(gateway, ModelRouter):
            return PublicModelCatalog(profiles=[], task_defaults={})
        return PublicModelCatalog(
            profiles=gateway.profiles,
            task_defaults={
                intent: gateway.defaults.get(intent, gateway.first)
                for intent in ("diagnose", "explain", "hint", "practice", "result_feedback")
            },
        )

    @app.get("/api/v1/courses/{course_id}/versions/{version_id}", tags=["Courses"])
    async def course_version(course_id: UUID, version_id: UUID):
        return content.get_version(course_id, version_id)

    @app.get("/api/v1/course-scopes", tags=["Courses"])
    async def course_scopes():
        return content.get_scope_catalog()

    @app.get("/api/v1/guest-nonce", tags=["Guest"], response_model=NonceResponse)
    async def guest_nonce(request: Request):
        origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
        return await store.nonce(origin)

    @app.post("/api/v1/guest-nonce", tags=["Guest"], response_model=NonceResponse)
    async def guest_nonce_create(request: Request):
        return await store.nonce(mutation_origin(request))

    @app.post("/api/v1/guest-leases", status_code=201, tags=["Guest"], response_model=LeaseResponse)
    async def create_lease(request: Request, body: LeaseRequest):
        return await store.create(body.nonce, mutation_origin(request))

    @app.post(
        "/api/v1/guest-leases/{lease_id}/operations",
        status_code=201,
        tags=["Guest"],
        response_model=OperationResponse,
    )
    async def create_operation(
        request: Request,
        lease_id: UUID,
        body: Annotated[TraceSubmission | TruthTableSubmission, Field(discriminator="kind")],
        idempotency_key: Annotated[UUID, Header()],
        authorization: Annotated[str | None, Header()] = None,
    ):
        return await store.start(
            lease_id, credential(authorization), mutation_origin(request), idempotency_key, body
        )

    @app.get(
        "/api/v1/guest-leases/{lease_id}/operations/{operation_id}",
        tags=["Guest"],
        response_model=OperationResponse,
    )
    async def operation_snapshot(
        lease_id: UUID, operation_id: UUID, authorization: Annotated[str | None, Header()] = None
    ):
        return await store.snapshot(lease_id, credential(authorization), operation_id)

    @app.post(
        "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/inputs",
        tags=["Guest"],
        response_model=OperationResponse,
    )
    async def operation_input(
        request: Request,
        lease_id: UUID,
        operation_id: UUID,
        body: OperationInput,
        authorization: Annotated[str | None, Header()] = None,
    ):
        return await store.input(
            lease_id, credential(authorization), mutation_origin(request), operation_id, body
        )

    @app.post(
        "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/cancel",
        tags=["Guest"],
        response_model=OperationResponse,
    )
    async def operation_cancel(
        request: Request,
        lease_id: UUID,
        operation_id: UUID,
        body: RevisionCommand,
        authorization: Annotated[str | None, Header()] = None,
    ):
        return await store.cancel(
            lease_id,
            credential(authorization),
            mutation_origin(request),
            operation_id,
            body.expected_revision,
        )

    @app.post(
        "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/ack",
        tags=["Guest"],
        response_model=OperationResponse,
    )
    async def operation_ack(
        request: Request,
        lease_id: UUID,
        operation_id: UUID,
        body: RevisionCommand,
        authorization: Annotated[str | None, Header()] = None,
    ):
        return await store.ack(
            lease_id,
            credential(authorization),
            mutation_origin(request),
            operation_id,
            body.expected_revision,
        )

    @app.get("/api/v1/guest-leases/{lease_id}/operations/{operation_id}/events", tags=["Guest"])
    async def operation_events(
        lease_id: UUID,
        operation_id: UUID,
        authorization: Annotated[str | None, Header()] = None,
        last_event_id: Annotated[str, Header()] = "0",
    ):
        token = credential(authorization)
        if not last_event_id.isascii() or not last_event_id.isdecimal() or len(last_event_id) > 20:
            raise ApiError(400, "EVENT_CURSOR_INVALID", "事件游标格式不正确。")
        cursor = int(last_event_id)
        await store.events(lease_id, token, operation_id, cursor)

        stream_id = await store.acquire_stream(lease_id, token, operation_id)

        async def stream():
            nonlocal cursor
            try:
                while True:
                    try:
                        events, terminal = await store.events(lease_id, token, operation_id, cursor)
                    except ApiError as error:
                        payload = json.dumps(
                            {"code": error.code, "message": error.message}, ensure_ascii=False
                        )
                        yield f"event: lease.unavailable\ndata: {payload}\n\n"
                        return
                    if events:
                        # One batch only; recheck the lease and operation on the next iteration.
                        event = events[0]
                        cursor = int(event["sequence"])
                        payload = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
                        yield f"id: {cursor}\nevent: {event['type']}\ndata: {payload}\n\n"
                    elif terminal:
                        return
                    else:
                        yield ": heartbeat\n\n"
                        await asyncio.sleep(1)
            finally:
                await store.release_stream(lease_id, stream_id)

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    @app.post(
        "/api/v1/guest-leases/{lease_id}/learning-assist",
        tags=["Learning"],
        response_model=LearningAssistReply,
    )
    async def learning_assist(
        request: Request,
        lease_id: UUID,
        body: LearningAssistRequest,
        authorization: Annotated[str | None, Header()] = None,
    ):
        agent = app.state.agent
        if not settings.agent_enabled or agent is None:
            raise ApiError(503, "AGENT_UNAVAILABLE", "学习助手尚未配置；作品仍保存在本地。")
        token, origin = credential(authorization), mutation_origin(request)
        if (body.intent == "result_feedback") != (body.operation_id is not None):
            raise ApiError(
                422, "VERIFICATION_REFERENCE_REQUIRED", "结果解读必须关联本次已完成的核验。"
            )
        payload_hash = canonical_hash(body.model_dump(mode="json"))
        cached = await store.begin_assist(lease_id, token, origin, body.request_id, payload_hash)
        if cached is not None:
            return cached
        completed = False
        try:
            verification = None
            if body.intent == "result_feedback":
                operation = await store.snapshot(lease_id, token, body.operation_id)
                result = operation.get("result")
                if operation.get("status") != "completed" or not result:
                    raise ApiError(
                        409, "VERIFICATION_NOT_COMPLETE", "只能解读已完成且仍可访问的核验结果。"
                    )
                if (
                    result.get("client_artifact_id") != str(body.artifact_id)
                    or result.get("client_revision_id") != str(body.revision_id)
                    or result.get("course_version") != body.course_version
                    or result.get("activity_version") != body.activity_version
                    or "e790d0f5-ea0a-4924-a482-06b9ff8ab944" not in result.get("objective_ids", [])
                ):
                    raise ApiError(
                        409,
                        "VERIFICATION_REFERENCE_MISMATCH",
                        "核验结果与当前作品版本或目标不匹配。",
                    )
                verification = {
                    "trace_correct": result["trace_correct"],
                    "summary": result["summary"],
                    "criteria": result["criteria"],
                    "mastery_asserted": False,
                    "provenance": "server_deterministic_checker",
                }
            reply = await agent.run(body, verification)
            value = reply.model_dump(mode="json")
            await store.complete_assist(lease_id, token, body.request_id, payload_hash, value)
            completed = True
            return value
        finally:
            if not completed:
                await store.fail_assist(lease_id, token, body.request_id, payload_hash)

    @app.post(
        "/api/v1/guest-leases/{lease_id}/personal-learning-assist",
        tags=["Learning"],
        response_model=LearningAssistReply,
    )
    async def personal_learning_assist(
        request: Request,
        lease_id: UUID,
        body: PersonalLearningAssistRequest,
        authorization: Annotated[str | None, Header()] = None,
    ):
        agent = app.state.agent
        if not settings.agent_enabled or agent is None:
            raise ApiError(503, "AGENT_UNAVAILABLE", "学习助手尚未配置；个人尝试仍保存在本地。")
        token, origin = credential(authorization), mutation_origin(request)
        payload_hash = canonical_hash(
            {"kind": "personal_learning_assist", **body.model_dump(mode="json")}
        )
        cached = await store.begin_assist(lease_id, token, origin, body.request_id, payload_hash)
        if cached is not None:
            return cached
        completed = False
        try:
            reply = await agent.run(body, None)
            value = reply.model_dump(mode="json")
            await store.complete_assist(lease_id, token, body.request_id, payload_hash, value)
            completed = True
            return value
        finally:
            if not completed:
                await store.fail_assist(lease_id, token, body.request_id, payload_hash)

    @app.post("/api/v1/execution-jobs", tags=["Execution"])
    async def execution_job():
        raise ApiError(
            503, "EXECUTION_UNAVAILABLE", "隔离执行环境尚未配置；不会在业务机器运行学生代码。"
        )

    return app


app = create_app()
