"""Development authentication with real PostgreSQL authority and private mail capture.

No HTTP endpoint returns an email capability. Production remains disabled until a
real mail adapter and production authentication acceptance are implemented.
"""

import argparse
import asyncio
import hashlib
import hmac
import json
import os
import secrets
from collections import defaultdict, deque
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Request, Response
from sqlalchemy import delete, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from vault_backend.auth_models import AccountAuthState, AuthEmailToken
from vault_backend.auth_schemas import (
    AccountOutput,
    AccountSessionOutput,
    ConfirmationOutput,
    ConfirmedOutput,
    CSRFOutput,
    EmailInput,
    LoginInput,
    LoginOutput,
    NonceOutput,
    PasswordResetOutput,
    RegisterInput,
    ResetConfirmInput,
    ResetRequestedOutput,
    TokenInput,
)
from vault_backend.config import Settings
from vault_backend.errors import ApiError
from vault_backend.models import Account, AuthSession, StudentProfile, TeacherProfile

SESSION_COOKIE = "vault_dev_session"
PREAUTH_COOKIE = "vault_dev_preauth"
COOKIE_PATH = "/api/v1"
PASSWORD_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1, type=Type.ID)
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


def digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def csrf_for(token: str) -> str:
    # This one-way derivative is recoverable from the HttpOnly session cookie by
    # the server, never grants authentication, and is not persisted in plaintext.
    return hmac.new(token.encode(), b"vault-csrf-v1", hashlib.sha256).hexdigest()


def authentication_required() -> ApiError:
    return ApiError(401, "AUTH_REQUIRED", "请登录后继续；本地学习记录仍可保留。")


def invalid_login() -> ApiError:
    return ApiError(401, "LOGIN_INVALID", "邮箱、密码或邮箱确认状态不符合登录条件。")


@dataclass(frozen=True)
class Principal:
    account_id: UUID
    account_type: str
    account: AccountOutput
    session_id: UUID

    @property
    def teacher_verification_state(self) -> str | None:
        return self.account.teacher_verification_state


class AuthService:
    def __init__(
        self,
        engine: AsyncEngine | None,
        settings: Settings,
        clock: Callable[[], datetime] | None = None,
    ):
        self.engine, self.settings = engine, settings
        self.clock = clock or (lambda: datetime.now(UTC))
        self.sessions = async_sessionmaker(engine, expire_on_commit=False) if engine else None
        self._nonces: dict[bytes, tuple[bytes, str, str, datetime]] = {}
        self._limits: dict[str, deque[datetime]] = defaultdict(deque)
        self._guard = asyncio.Lock()
        self._password_jobs = asyncio.Semaphore(2)
        self._dummy_hash: str | None = None

    def require_available(self) -> None:
        if not self.settings.auth_enabled or self.sessions is None:
            raise ApiError(503, "AUTH_UNAVAILABLE", "账号服务尚未启用，可继续在本机学习。")

    def origin(self, request: Request) -> str:
        supplied = request.headers.get("origin", "")
        if supplied not in self.settings.allowed_origins:
            raise ApiError(403, "ORIGIN_DENIED", "认证写操作需要允许的同源来源。")
        return supplied

    def client_key(self, request: Request) -> str:
        # Forwarded headers are never trusted without an explicitly configured proxy.
        return request.client.host if request.client else "unknown"

    async def limit(self, key: str, maximum: int, window: int = 600) -> None:
        now = self.clock()
        async with self._guard:
            for stale in list(self._limits):
                bucket = self._limits[stale]
                while bucket and bucket[0] <= now - timedelta(seconds=window):
                    bucket.popleft()
                if not bucket:
                    del self._limits[stale]
            if key not in self._limits and len(self._limits) >= 3000:
                raise ApiError(429, "AUTH_RATE_LIMIT", "认证请求较多，请稍后再试。", retryable=True)
            bucket = self._limits[key]
            if len(bucket) >= maximum:
                raise ApiError(429, "AUTH_RATE_LIMIT", "认证请求较多，请稍后再试。", retryable=True)
            bucket.append(now)

    async def nonce(self, request: Request, response: Response) -> NonceOutput:
        self.require_available()
        origin, client = self.origin(request), self.client_key(request)
        await self.limit(f"nonce:{client}", 120)
        binding = request.cookies.get(PREAUTH_COOKIE)
        if binding is None or not 32 <= len(binding) <= 128:
            binding = secrets.token_urlsafe(32)
        token, now = secrets.token_urlsafe(32), self.clock()
        async with self._guard:
            self._nonces = {key: value for key, value in self._nonces.items() if value[3] > now}
            if len(self._nonces) >= 1000:
                raise ApiError(429, "AUTH_RATE_LIMIT", "认证请求较多，请稍后再试。", retryable=True)
            self._nonces[digest(token)] = (
                digest(binding),
                origin,
                client,
                now + timedelta(seconds=self.settings.auth_nonce_seconds),
            )
        response.set_cookie(
            PREAUTH_COOKIE,
            binding,
            httponly=True,
            secure=self.secure_cookie,
            samesite="strict",
            path=COOKIE_PATH,
            max_age=self.settings.auth_nonce_seconds,
        )
        return NonceOutput(nonce=token)

    @property
    def secure_cookie(self) -> bool:
        return self.settings.environment == "production"

    async def consume_nonce(self, request: Request, nonce: str) -> None:
        self.require_available()
        origin, client = self.origin(request), self.client_key(request)
        binding = request.cookies.get(PREAUTH_COOKIE, "")
        async with self._guard:
            stored = self._nonces.pop(digest(nonce), None)
        if (
            stored is None
            or stored[3] <= self.clock()
            or stored[1] != origin
            or stored[2] != client
            or not hmac.compare_digest(stored[0], digest(binding))
        ):
            raise ApiError(403, "AUTH_NONCE_INVALID", "认证请求已过期，请重新提交。")
        await self.limit(f"auth:{client}", 60)
        await self.limit("auth:global", 300)

    async def password_hash(self, password: str) -> str:
        async with self._password_jobs:
            return await asyncio.to_thread(PASSWORD_HASHER.hash, password)

    async def password_matches(self, encoded: str | None, password: str) -> bool:
        async with self._password_jobs:
            if encoded is None:
                if self._dummy_hash is None:
                    self._dummy_hash = await asyncio.to_thread(
                        PASSWORD_HASHER.hash, secrets.token_urlsafe(32)
                    )
                encoded = self._dummy_hash
            try:
                return await asyncio.to_thread(PASSWORD_HASHER.verify, encoded, password)
            except (VerificationError, InvalidHashError):
                return False

    async def issue_email_token(
        self,
        session: AsyncSession,
        account: Account,
        purpose: str,
        registration: tuple[str, str, str] | None = None,
    ) -> tuple[str, str, str]:
        now, token = self.clock(), secrets.token_urlsafe(32)
        # New issuance invalidates earlier links of the same purpose.
        await session.execute(
            update(AuthEmailToken)
            .where(
                AuthEmailToken.account_id == account.id,
                AuthEmailToken.purpose == purpose,
                AuthEmailToken.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )
        session.add(
            AuthEmailToken(
                account_id=account.id,
                purpose=purpose,
                token_digest=digest(token),
                created_at=now,
                expires_at=now + timedelta(seconds=self.settings.auth_email_token_seconds),
                pending_password_hash=registration[0] if registration else None,
                pending_account_type=registration[1] if registration else None,
                pending_display_name=registration[2] if registration else None,
            )
        )
        return account.email_display, purpose, token

    def capture_mail(self, mail: tuple[str, str, str]) -> None:
        path = self.settings.mail_capture_dir
        if path is None or self.settings.environment == "production":
            raise ApiError(
                503, "MAIL_UNAVAILABLE", "账号邮件暂不可用，请稍后重试。", retryable=True
            )
        try:
            path.mkdir(mode=0o700, parents=True, exist_ok=True)
            destination = path / f"{uuid4()}.json"
            descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as capture:
                json.dump(
                    {
                        "to": mail[0],
                        "purpose": mail[1],
                        "token": mail[2],
                        "captured_at": self.clock().isoformat(),
                    },
                    capture,
                    ensure_ascii=False,
                )
        except OSError as exc:
            raise ApiError(
                503, "MAIL_UNAVAILABLE", "账号邮件暂不可用，请稍后重试。", retryable=True
            ) from exc

    async def register(self, request: Request, body: RegisterInput) -> ConfirmationOutput:
        await self.consume_nonce(request, body.nonce)
        email = body.email.lower()
        await self.limit(f"register:{digest(email).hex()}", 5)
        encoded = await self.password_hash(body.password)
        mail = None
        assert self.sessions is not None
        async with self.sessions.begin() as session:
            account_id = uuid4()
            result = await session.execute(
                insert(Account)
                .values(
                    id=account_id,
                    account_type=body.account_type,
                    email_normalized=email,
                    email_display=body.email,
                    password_hash=encoded,
                )
                .on_conflict_do_nothing(index_elements=[Account.email_normalized])
                .returning(Account.id)
            )
            created = result.scalar_one_or_none() is not None
            account = await session.scalar(
                select(Account).where(Account.email_normalized == email).with_for_update()
            )
            assert account is not None
            if created:
                session.add(AccountAuthState(account_id=account.id))
                profile_class = StudentProfile if body.account_type == "student" else TeacherProfile
                session.add(profile_class(account_id=account.id, display_name=body.display_name))
                await session.flush()
            state = await session.get(AccountAuthState, account.id)
            if state and state.email_verified_at is None and account.status == "active":
                mail = await self.issue_email_token(
                    session,
                    account,
                    "verify_email",
                    (encoded, body.account_type, body.display_name),
                )
        if mail:
            self.capture_mail(mail)
        return ConfirmationOutput()

    async def token_transaction(
        self, session: AsyncSession, raw: str, purpose: str
    ) -> tuple[Account, AuthEmailToken]:
        token = await session.scalar(
            select(AuthEmailToken).where(
                AuthEmailToken.token_digest == digest(raw), AuthEmailToken.purpose == purpose
            )
        )
        if token is None:
            raise ApiError(400, "AUTH_TOKEN_INVALID", "邮件链接已失效，请重新申请。")
        account = await session.scalar(
            select(Account).where(Account.id == token.account_id).with_for_update()
        )
        token = await session.scalar(
            select(AuthEmailToken)
            .where(AuthEmailToken.id == token.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if (
            account is None
            or account.status != "active"
            or token is None
            or token.consumed_at
            or token.expires_at <= self.clock()
        ):
            raise ApiError(400, "AUTH_TOKEN_INVALID", "邮件链接已失效，请重新申请。")
        return account, token

    async def verify_email(self, request: Request, body: TokenInput) -> ConfirmedOutput:
        await self.consume_nonce(request, body.nonce)
        assert self.sessions is not None
        async with self.sessions.begin() as session:
            account, token = await self.token_transaction(session, body.token, "verify_email")
            state = await session.get(AccountAuthState, account.id)
            if state is None or state.email_verified_at is not None:
                raise ApiError(400, "AUTH_TOKEN_INVALID", "邮件链接已失效，请重新申请。")
            # An email owner who re-registers must activate that registration's
            # password and account type, never an earlier unverified claimant's.
            account.password_hash = token.pending_password_hash
            account.auth_revision += 1
            if account.account_type != token.pending_account_type:
                previous = StudentProfile if account.account_type == "student" else TeacherProfile
                await session.execute(delete(previous).where(previous.account_id == account.id))
                account.account_type = token.pending_account_type
                await session.flush()
                selected = StudentProfile if account.account_type == "student" else TeacherProfile
                session.add(
                    selected(account_id=account.id, display_name=token.pending_display_name)
                )
            else:
                selected = StudentProfile if account.account_type == "student" else TeacherProfile
                profile = await session.get(selected, account.id)
                assert profile is not None
                profile.display_name = token.pending_display_name
            state.email_verified_at = self.clock()
            await session.execute(
                update(AuthEmailToken)
                .where(
                    AuthEmailToken.account_id == account.id,
                    AuthEmailToken.purpose == "verify_email",
                    AuthEmailToken.consumed_at.is_(None),
                )
                .values(consumed_at=self.clock())
            )
            await session.execute(
                update(AuthSession)
                .where(AuthSession.account_id == account.id)
                .values(revoked_at=self.clock())
            )
        return ConfirmedOutput()

    async def account_output(self, session: AsyncSession, account: Account) -> AccountOutput:
        if account.account_type == "student":
            profile = await session.get(StudentProfile, account.id)
            verification = None
        else:
            profile = await session.get(TeacherProfile, account.id)
            verification = profile.verification_state if profile else None
        if profile is None:
            raise authentication_required()
        return AccountOutput(
            id=account.id,
            email=account.email_display,
            display_name=profile.display_name,
            account_type=account.account_type,
            teacher_verification_state=verification,
        )

    async def login(self, request: Request, response: Response, body: LoginInput) -> LoginOutput:
        await self.consume_nonce(request, body.nonce)
        await self.limit(f"login:{digest(body.email.lower()).hex()}", 12)
        assert self.sessions is not None
        async with self.sessions() as session:
            snapshot = await session.scalar(
                select(Account).where(Account.email_normalized == body.email.lower())
            )
            encoded = snapshot.password_hash if snapshot else None
            account_id = snapshot.id if snapshot else None
        matches = await self.password_matches(encoded, body.password)
        if not matches or account_id is None:
            raise invalid_login()
        token, now = secrets.token_urlsafe(32), self.clock()
        csrf = csrf_for(token)
        async with self.sessions.begin() as session:
            account = await session.scalar(
                select(Account).where(Account.id == account_id).with_for_update()
            )
            state = await session.get(AccountAuthState, account_id)
            if (
                account is None
                or account.password_hash != encoded
                or account.status != "active"
                or state is None
                or state.email_verified_at is None
            ):
                raise invalid_login()
            if PASSWORD_HASHER.check_needs_rehash(encoded):
                account.password_hash = await self.password_hash(body.password)
            session.add(
                AuthSession(
                    account_id=account.id,
                    token_digest=digest(token),
                    csrf_digest=digest(csrf),
                    auth_revision=account.auth_revision,
                    created_at=now,
                    last_seen_at=now,
                    idle_expires_at=now + timedelta(seconds=self.settings.auth_idle_seconds),
                    absolute_expires_at=now
                    + timedelta(seconds=self.settings.auth_absolute_seconds),
                )
            )
            output = await self.account_output(session, account)
        # Rotation revokes this browser's previous credential, including an old
        # account credential, in the same lock order as normal authorization.
        old = request.cookies.get(SESSION_COOKIE)
        if old:
            await self.revoke_token(old)
        response.set_cookie(
            SESSION_COOKIE,
            token,
            httponly=True,
            secure=self.secure_cookie,
            samesite="strict",
            path=COOKIE_PATH,
            max_age=self.settings.auth_absolute_seconds,
        )
        return LoginOutput(account=output, csrf_token=csrf)

    async def revoke_token(self, token: str) -> None:
        assert self.sessions is not None
        async with self.sessions.begin() as session:
            owner = await session.scalar(
                select(AuthSession.account_id).where(AuthSession.token_digest == digest(token))
            )
            if owner is not None:
                await session.scalar(select(Account).where(Account.id == owner).with_for_update())
                await session.execute(
                    update(AuthSession)
                    .where(AuthSession.token_digest == digest(token))
                    .values(revoked_at=self.clock())
                )

    @asynccontextmanager
    async def authorized_transaction(
        self, request: Request, *, write: bool = True
    ) -> AsyncIterator[tuple[AsyncSession, Principal]]:
        self.require_available()
        raw = request.cookies.get(SESSION_COOKIE, "")
        if not 32 <= len(raw) <= 128:
            raise authentication_required()
        if write:
            self.origin(request)
        assert self.sessions is not None
        async with self.sessions.begin() as session:
            owner = await session.scalar(
                select(AuthSession.account_id).where(AuthSession.token_digest == digest(raw))
            )
            if owner is None:
                raise authentication_required()
            account = await session.scalar(
                select(Account).where(Account.id == owner).with_for_update()
            )
            credential = await session.scalar(
                select(AuthSession).where(AuthSession.token_digest == digest(raw)).with_for_update()
            )
            now = self.clock()
            state = await session.get(AccountAuthState, owner)
            if (
                account is None
                or credential is None
                or account.status != "active"
                or credential.revoked_at is not None
                or credential.auth_revision != account.auth_revision
                or min(credential.idle_expires_at, credential.absolute_expires_at) <= now
                or state is None
                or state.email_verified_at is None
            ):
                raise authentication_required()
            if write:
                supplied = request.headers.get("x-csrf-token", "")
                if not hmac.compare_digest(credential.csrf_digest, digest(supplied)):
                    raise ApiError(403, "CSRF_INVALID", "会话校验失败，请刷新后重试。")
            credential.last_seen_at = now
            credential.idle_expires_at = min(
                now + timedelta(seconds=self.settings.auth_idle_seconds),
                credential.absolute_expires_at,
            )
            output = await self.account_output(session, account)
            await session.execute(
                text("SELECT set_config('vault.account_id', :actor, true)"),
                {"actor": str(account.id)},
            )
            yield session, Principal(account.id, account.account_type, output, credential.id)

    async def reset_request(self, request: Request, body: EmailInput) -> ResetRequestedOutput:
        await self.consume_nonce(request, body.nonce)
        await self.limit(f"reset:{digest(body.email.lower()).hex()}", 5)
        mail = None
        assert self.sessions is not None
        async with self.sessions.begin() as session:
            account = await session.scalar(
                select(Account)
                .where(Account.email_normalized == body.email.lower())
                .with_for_update()
            )
            state = await session.get(AccountAuthState, account.id) if account else None
            if account and account.status == "active" and state and state.email_verified_at:
                mail = await self.issue_email_token(session, account, "reset_password")
        if mail:
            self.capture_mail(mail)
        return ResetRequestedOutput()

    async def reset_confirm(self, request: Request, body: ResetConfirmInput) -> PasswordResetOutput:
        await self.consume_nonce(request, body.nonce)
        encoded = await self.password_hash(body.password)
        assert self.sessions is not None
        async with self.sessions.begin() as session:
            account, token = await self.token_transaction(session, body.token, "reset_password")
            account.password_hash = encoded
            account.auth_revision += 1
            token.consumed_at = self.clock()
            await session.execute(
                update(AuthSession)
                .where(AuthSession.account_id == account.id, AuthSession.revoked_at.is_(None))
                .values(revoked_at=self.clock())
            )
        return PasswordResetOutput()


@asynccontextmanager
async def authorized_transaction(request: Request, *, write: bool = True):
    service: AuthService = request.app.state.auth
    async with service.authorized_transaction(request, write=write) as authorized:
        yield authorized


@router.post("/nonce", response_model=NonceOutput)
async def nonce(request: Request, response: Response):
    return await request.app.state.auth.nonce(request, response)


@router.post("/register", response_model=ConfirmationOutput)
async def register(request: Request, body: RegisterInput):
    return await request.app.state.auth.register(request, body)


@router.post("/verify-email", response_model=ConfirmedOutput)
async def verify_email(request: Request, body: TokenInput):
    return await request.app.state.auth.verify_email(request, body)


@router.post("/login", response_model=LoginOutput)
async def login(request: Request, response: Response, body: LoginInput):
    return await request.app.state.auth.login(request, response, body)


@router.get("/session", response_model=AccountSessionOutput)
async def current_session(request: Request):
    async with authorized_transaction(request, write=False) as (_, principal):
        return AccountSessionOutput(account=principal.account)


@router.get("/csrf", response_model=CSRFOutput)
async def current_csrf(request: Request):
    async with authorized_transaction(request, write=False):
        return CSRFOutput(csrf_token=csrf_for(request.cookies[SESSION_COOKIE]))


@router.post("/logout", status_code=204)
async def logout(request: Request):
    async with authorized_transaction(request) as (session, principal):
        await session.execute(
            update(AuthSession)
            .where(AuthSession.id == principal.session_id)
            .values(revoked_at=request.app.state.auth.clock())
        )
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path=COOKIE_PATH, httponly=True, samesite="strict")
    return response


@router.post("/password-reset/request", response_model=ResetRequestedOutput)
async def reset_request(request: Request, body: EmailInput):
    return await request.app.state.auth.reset_request(request, body)


@router.post("/password-reset/confirm", response_model=PasswordResetOutput)
async def reset_confirm(request: Request, body: ResetConfirmInput):
    return await request.app.state.auth.reset_confirm(request, body)


def main() -> None:
    """Print a selected captured email locally; never mount the directory in HTTP."""
    parser = argparse.ArgumentParser(description="Read private development authentication email")
    parser.add_argument("--email", required=True)
    parser.add_argument("--purpose", choices=["verify_email", "reset_password"], required=True)
    arguments = parser.parse_args()
    settings = Settings()
    if (
        not settings.auth_enabled
        or settings.environment == "production"
        or settings.mail_capture_dir is None
    ):
        parser.error("Private development mail capture is not enabled")
    captures = []
    for path in settings.mail_capture_dir.glob("*.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if (
            payload["to"].lower() == arguments.email.lower()
            and payload["purpose"] == arguments.purpose
        ):
            captures.append(payload)
    if not captures:
        parser.error("No matching captured email")
    print(json.dumps(max(captures, key=lambda item: item["captured_at"]), ensure_ascii=False))


if __name__ == "__main__":
    main()
