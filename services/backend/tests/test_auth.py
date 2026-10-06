import asyncio
import json
import os
from contextlib import asynccontextmanager
from uuid import uuid4

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from vault_backend import auth
from vault_backend.api import create_app
from vault_backend.auth_models import AccountAuthState, AuthEmailToken
from vault_backend.config import Settings
from vault_backend.db import create_engine
from vault_backend.models import Account, AuthSession

pytestmark = pytest.mark.postgres
ORIGIN = "http://localhost:5173"
PASSWORD = "Synthetic-learning-2026!"


@pytest.fixture
async def authentication(tmp_path, clock):
    owner_url = os.environ.get("VAULT_TEST_DATABASE_URL", "")
    runtime_url = os.environ.get("VAULT_TEST_API_DATABASE_URL", "")
    if not owner_url or not runtime_url:
        pytest.skip("Authentication requires disposable PostgreSQL owner and runtime URLs")
    if os.environ.get("VAULT_TEST_DATABASE_IS_DISPOSABLE") != "1":
        raise pytest.UsageError("Authentication tests require a disposable database")
    engine = create_engine(runtime_url)
    settings = Settings(
        environment="test",
        database_url=runtime_url,
        auth_enabled=True,
        mail_capture_dir=tmp_path / "private-email",
        auth_idle_seconds=10,
        auth_absolute_seconds=30,
        auth_email_token_seconds=15,
        auth_nonce_seconds=10,
    )
    app = create_app(settings)
    app.state.auth = service = auth.AuthService(engine, settings, clock)

    @asynccontextmanager
    async def client():
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://localhost:8000",
            headers={"Origin": ORIGIN},
        ) as instance:
            yield instance

    try:
        yield app, service, client, settings.mail_capture_dir
    finally:
        await engine.dispose()
        if app.state.engine is not engine:
            await app.state.engine.dispose()
        # All rows have a random synthetic test address, and only these fixtures
        # are deleted. This must never run against a non-disposable database.
        with psycopg.connect(owner_url.replace("postgresql+psycopg://", "postgresql://", 1)) as db:
            ids = [
                row[0]
                for row in db.execute(
                    "SELECT id FROM account WHERE email_normalized LIKE '%@auth.invalid.test'"
                )
            ]
            for table in (
                "auth_email_token",
                "auth_session",
                "account_auth_state",
                "student_profile",
                "teacher_profile",
            ):
                db.execute(f"DELETE FROM {table} WHERE account_id = ANY(%s)", (ids,))
            db.execute("DELETE FROM account WHERE id = ANY(%s)", (ids,))


async def nonce(client):
    response = await client.post("/api/v1/auth/nonce")
    assert response.status_code == 200
    return response.json()["nonce"]


def mail_token(directory, email, purpose):
    candidates = []
    for path in directory.glob("*.json"):
        mail = json.loads(path.read_text(encoding="utf-8"))
        if mail["to"].lower() == email.lower() and mail["purpose"] == purpose:
            candidates.append((path.stat().st_mtime_ns, mail["token"]))
    assert candidates, "A private email capability should be captured outside HTTP"
    return max(candidates)[1]


async def register(client, account_type="student"):
    email = f"{uuid4()}@auth.invalid.test"
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "nonce": await nonce(client),
            "email": email,
            "password": PASSWORD,
            "display_name": "学习测试",
            "account_type": account_type,
        },
    )
    assert response.status_code == 200
    assert response.json() == {"status": "confirmation_required"}
    return email


async def verified_login(client, directory, account_type="student"):
    email = await register(client, account_type)
    confirmed = await client.post(
        "/api/v1/auth/verify-email",
        json={
            "nonce": await nonce(client),
            "token": mail_token(directory, email, "verify_email"),
        },
    )
    assert confirmed.status_code == 200
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "nonce": await nonce(client),
            "email": email,
            "password": PASSWORD,
        },
    )
    assert response.status_code == 200
    return email, response.json(), client.cookies.get(auth.SESSION_COOKIE)


async def test_real_registration_confirmation_cookie_and_logout(authentication):
    _, service, clients, directory = authentication
    async with clients() as client:
        email, payload, raw = await verified_login(client, directory)
        assert payload["account"]["account_type"] == "student"
        assert payload["account"]["teacher_verification_state"] is None
        assert (await client.get("/api/v1/auth/session")).status_code == 200
        assert (await client.get("/api/v1/auth/csrf")).json()["csrf_token"] == payload["csrf_token"]
        async with service.sessions() as session:
            account = await session.scalar(select(Account).where(Account.email_normalized == email))
            assert account.password_hash.startswith("$argon2id$v=19$m=65536,t=3,p=1$")
            credential = await session.scalar(
                select(AuthSession).where(AuthSession.account_id == account.id)
            )
            assert credential.token_digest == auth.digest(raw)
            assert credential.csrf_digest == auth.digest(payload["csrf_token"])
            state = await session.get(AccountAuthState, account.id)
            assert state.email_verified_at is not None
        assert (await client.post("/api/v1/auth/logout")).status_code == 403
        result = await client.post(
            "/api/v1/auth/logout", headers={"X-CSRF-Token": payload["csrf_token"]}
        )
        assert result.status_code == 204
        client.cookies.set(auth.SESSION_COOKIE, raw, path=auth.COOKIE_PATH)
        assert (await client.get("/api/v1/auth/session")).status_code == 401


async def test_teacher_pending_and_no_client_self_verification(authentication):
    _, _, clients, directory = authentication
    async with clients() as client:
        _, payload, _ = await verified_login(client, directory, "teacher")
        assert payload["account"]["teacher_verification_state"] == "pending"
        invalid = await client.post(
            "/api/v1/auth/register",
            json={
                "nonce": await nonce(client),
                "email": f"{uuid4()}@auth.invalid.test",
                "password": PASSWORD,
                "display_name": "无越权",
                "account_type": "teacher",
                "teacher_verification_state": "verified",
            },
        )
        assert invalid.status_code == 422
        assert "input" not in invalid.text and PASSWORD not in invalid.text


async def test_login_errors_do_not_enumerate_accounts(authentication):
    _, _, clients, _ = authentication
    async with clients() as client:
        existing = await register(client)
        failures = []
        for email, password in (
            (existing, PASSWORD),
            (existing, "incorrect"),
            (f"{uuid4()}@auth.invalid.test", PASSWORD),
        ):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "nonce": await nonce(client),
                    "email": email,
                    "password": password,
                },
            )
            assert response.status_code == 401
            failures.append((response.json()["code"], response.json()["message"]))
        assert failures[0] == failures[1] == failures[2]


async def test_nonce_origin_binding_expiry_and_reuse(authentication, clock):
    _, _, clients, _ = authentication
    async with clients() as a, clients() as b:
        forged = await a.post("/api/v1/auth/nonce", headers={"Origin": "https://untrusted.invalid"})
        assert forged.status_code == 403
        missing = await a.post("/api/v1/auth/nonce", headers={"Origin": ""})
        assert missing.status_code == 403
        owned = await nonce(a)
        assert (
            await b.post(
                "/api/v1/auth/login",
                json={
                    "nonce": owned,
                    "email": "missing@auth.invalid.test",
                    "password": PASSWORD,
                },
            )
        ).status_code == 403
        owned = await nonce(a)
        data = {"nonce": owned, "email": "missing@auth.invalid.test", "password": PASSWORD}
        assert (await a.post("/api/v1/auth/login", json=data)).status_code == 401
        assert (await a.post("/api/v1/auth/login", json=data)).status_code == 403
        data["nonce"] = await nonce(a)
        clock.advance(11)
        assert (await a.post("/api/v1/auth/login", json=data)).status_code == 403


async def test_email_capability_is_single_use_under_concurrency(authentication):
    _, service, clients, directory = authentication
    async with clients() as a, clients() as b:
        email = await register(a)
        token = mail_token(directory, email, "verify_email")
        nonce_a, nonce_b = await nonce(a), await nonce(b)
        replies = await asyncio.gather(
            a.post("/api/v1/auth/verify-email", json={"nonce": nonce_a, "token": token}),
            b.post("/api/v1/auth/verify-email", json={"nonce": nonce_b, "token": token}),
        )
        assert sorted(reply.status_code for reply in replies) == [200, 400]
        async with service.sessions() as session:
            stored = await session.scalar(
                select(AuthEmailToken).where(AuthEmailToken.token_digest == auth.digest(token))
            )
            assert stored.consumed_at is not None
            assert len(stored.token_digest) == 32


async def test_email_capability_expires_and_cannot_reset_password(authentication, clock):
    _, _, clients, directory = authentication
    async with clients() as client:
        email = await register(client)
        token = mail_token(directory, email, "verify_email")
        wrong_purpose = await client.post(
            "/api/v1/auth/password-reset/confirm",
            json={
                "nonce": await nonce(client),
                "token": token,
                "password": "Another-synthetic-password",
            },
        )
        assert wrong_purpose.status_code == 400
        clock.advance(16)
        expired = await client.post(
            "/api/v1/auth/verify-email",
            json={
                "nonce": await nonce(client),
                "token": token,
            },
        )
        assert expired.status_code == 400


@pytest.mark.parametrize("expiry", ["idle", "absolute"])
async def test_server_session_expiry_is_authoritative(authentication, clock, expiry):
    _, _, clients, directory = authentication
    async with clients() as client:
        await verified_login(client, directory)
        if expiry == "idle":
            clock.advance(11)
        else:
            for _ in range(3):
                clock.advance(9)
                assert (await client.get("/api/v1/auth/session")).status_code == 200
            clock.advance(4)
        assert (await client.get("/api/v1/auth/session")).status_code == 401


@pytest.mark.parametrize("change", ["revision", "suspended"])
async def test_account_revision_and_status_revoke_authority(authentication, change):
    _, service, clients, directory = authentication
    async with clients() as client:
        email, _, _ = await verified_login(client, directory)
        async with service.sessions.begin() as session:
            row = await session.scalar(
                select(Account).where(Account.email_normalized == email).with_for_update()
            )
            if change == "revision":
                row.auth_revision += 1
            else:
                row.status = "suspended"
        assert (await client.get("/api/v1/auth/session")).status_code == 401


async def test_reset_is_generic_single_use_and_revokes_all_sessions(authentication):
    _, _, clients, directory = authentication
    async with clients() as a, clients() as b:
        email, _, _ = await verified_login(a, directory)
        login_b = await b.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(b),
                "email": email,
                "password": PASSWORD,
            },
        )
        assert login_b.status_code == 200
        outputs = []
        for address in (email, f"{uuid4()}@auth.invalid.test"):
            result = await a.post(
                "/api/v1/auth/password-reset/request",
                json={
                    "nonce": await nonce(a),
                    "email": address,
                },
            )
            assert result.status_code == 200
            outputs.append(result.json())
        assert outputs[0] == outputs[1] == {"status": "reset_requested"}
        token = mail_token(directory, email, "reset_password")
        new_password = "New-synthetic-password-2026!"
        reset = await a.post(
            "/api/v1/auth/password-reset/confirm",
            json={
                "nonce": await nonce(a),
                "token": token,
                "password": new_password,
            },
        )
        assert reset.status_code == 200
        assert (await a.get("/api/v1/auth/session")).status_code == 401
        assert (await b.get("/api/v1/auth/session")).status_code == 401
        replay = await a.post(
            "/api/v1/auth/password-reset/confirm",
            json={
                "nonce": await nonce(a),
                "token": token,
                "password": PASSWORD,
            },
        )
        assert replay.status_code == 400
        assert (
            await a.post(
                "/api/v1/auth/login",
                json={
                    "nonce": await nonce(a),
                    "email": email,
                    "password": PASSWORD,
                },
            )
        ).status_code == 401
        assert (
            await a.post(
                "/api/v1/auth/login",
                json={
                    "nonce": await nonce(a),
                    "email": email,
                    "password": new_password,
                },
            )
        ).status_code == 200


async def test_login_rate_is_bounded_and_uniform(authentication):
    _, _, clients, _ = authentication
    async with clients() as client:
        for _ in range(12):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "nonce": await nonce(client),
                    "email": "missing@auth.invalid.test",
                    "password": PASSWORD,
                },
            )
            assert response.status_code == 401
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(client),
                "email": "missing@auth.invalid.test",
                "password": PASSWORD,
            },
        )
        assert response.status_code == 429


async def test_authorized_transaction_holds_revocation_lock(authentication):
    app, service, clients, directory = authentication
    entered, release = asyncio.Event(), asyncio.Event()

    @app.post("/api/v1/test-held-write")
    async def held_write(request: auth.Request):
        async with auth.authorized_transaction(request) as (session, principal):
            assert await session.scalar(
                text("SELECT current_setting('vault.account_id',true)")
            ) == str(principal.account_id)
            entered.set()
            await release.wait()
        return {"status": "committed"}

    async with clients() as client:
        _, payload, _ = await verified_login(client, directory)
        headers = {"X-CSRF-Token": payload["csrf_token"]}
        writing = asyncio.create_task(client.post("/api/v1/test-held-write", headers=headers))
        await asyncio.wait_for(entered.wait(), 3)
        logging_out = asyncio.create_task(client.post("/api/v1/auth/logout", headers=headers))
        await asyncio.sleep(0.05)
        assert not logging_out.done(), "Revocation must serialize with already authorized writes"
        release.set()
        assert (await writing).status_code == 200
        assert (await logging_out).status_code == 204
        assert (await client.get("/api/v1/auth/session")).status_code == 401
        async with service.sessions() as session:
            assert (
                await session.scalar(
                    text("SELECT nullif(current_setting('vault.account_id',true),'')")
                )
                is None
            )


async def test_registration_duplicate_preserves_original_role_and_password(authentication):
    _, service, clients, directory = authentication
    async with clients() as client:
        email, _, _ = await verified_login(client, directory)
        result = await client.post(
            "/api/v1/auth/register",
            json={
                "nonce": await nonce(client),
                "email": f" {email.upper()} ",
                "password": "Different-synthetic-password",
                "display_name": "替换名字",
                "account_type": "teacher",
            },
        )
        assert result.status_code == 200
        async with service.sessions() as session:
            row = await session.scalar(select(Account).where(Account.email_normalized == email))
            assert row.account_type == "student"
            assert await service.password_matches(row.password_hash, PASSWORD)


async def test_email_owner_registration_cannot_activate_prior_claimants_password(authentication):
    _, service, clients, directory = authentication
    async with clients() as attacker, clients() as owner:
        email = await register(attacker, "teacher")
        first_token = mail_token(directory, email, "verify_email")
        owner_password = "Owner-selected-password-2026!"
        replacement = await owner.post(
            "/api/v1/auth/register",
            json={
                "nonce": await nonce(owner),
                "email": email,
                "password": owner_password,
                "display_name": "邮箱主人",
                "account_type": "student",
            },
        )
        assert replacement.status_code == 200
        latest_token = mail_token(directory, email, "verify_email")
        assert latest_token != first_token
        old_link = await attacker.post(
            "/api/v1/auth/verify-email",
            json={
                "nonce": await nonce(attacker),
                "token": first_token,
            },
        )
        assert old_link.status_code == 400
        confirmed = await owner.post(
            "/api/v1/auth/verify-email",
            json={
                "nonce": await nonce(owner),
                "token": latest_token,
            },
        )
        assert confirmed.status_code == 200
        attacker_login = await attacker.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(attacker),
                "email": email,
                "password": PASSWORD,
            },
        )
        assert attacker_login.status_code == 401
        owner_login = await owner.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(owner),
                "email": email,
                "password": owner_password,
            },
        )
        assert owner_login.status_code == 200
        assert owner_login.json()["account"]["account_type"] == "student"
        assert owner_login.json()["account"]["display_name"] == "邮箱主人"
        async with service.sessions() as session:
            row = await session.scalar(select(Account).where(Account.email_normalized == email))
            assert row.auth_revision == 2


async def test_cookie_security_and_no_mail_tokens_in_public_http(authentication):
    _, _, clients, directory = authentication
    async with clients() as client:
        email = await register(client)
        raw = mail_token(directory, email, "verify_email")
        assert (await client.get("/api/v1/auth/session")).status_code == 401
        assert (await client.get("/api/v1/auth/captured-mail")).status_code == 404
        openapi = (await client.get("/api/v1/openapi.json")).text
        assert raw not in openapi
        confirm = await client.post(
            "/api/v1/auth/verify-email",
            json={
                "nonce": await nonce(client),
                "token": raw,
            },
        )
        assert raw not in confirm.text
        login = await client.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(client),
                "email": email,
                "password": PASSWORD,
            },
        )
        cookie = login.headers["set-cookie"]
        assert "HttpOnly" in cookie and "Path=/api/v1" in cookie and "SameSite=strict" in cookie
        assert client.cookies.get(auth.SESSION_COOKIE) not in login.text


async def test_relogin_rotates_browser_session_and_old_cookie_cannot_write(authentication):
    _, _, clients, directory = authentication
    async with clients() as client, clients() as old_browser:
        email, original, old_token = await verified_login(client, directory)
        replacement = await client.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(client),
                "email": email,
                "password": PASSWORD,
            },
        )
        assert replacement.status_code == 200
        assert client.cookies.get(auth.SESSION_COOKIE) != old_token
        old_browser.cookies.set(auth.SESSION_COOKIE, old_token, path=auth.COOKIE_PATH)
        assert (await old_browser.get("/api/v1/auth/session")).status_code == 401
        assert (
            await old_browser.post(
                "/api/v1/auth/logout",
                headers={
                    "X-CSRF-Token": original["csrf_token"],
                },
            )
        ).status_code == 401
        assert (await client.get("/api/v1/auth/session")).status_code == 200


async def test_valid_csrf_does_not_bypass_origin_and_other_session_token(authentication):
    _, _, clients, directory = authentication
    async with clients() as a, clients() as b:
        email, first, _ = await verified_login(a, directory)
        second = await b.post(
            "/api/v1/auth/login",
            json={
                "nonce": await nonce(b),
                "email": email,
                "password": PASSWORD,
            },
        )
        assert second.status_code == 200
        rejected = await a.post(
            "/api/v1/auth/logout",
            headers={
                "X-CSRF-Token": first["csrf_token"],
                "Origin": "https://untrusted.invalid",
            },
        )
        assert rejected.status_code == 403
        rejected = await a.post(
            "/api/v1/auth/logout",
            headers={
                "X-CSRF-Token": second.json()["csrf_token"],
            },
        )
        assert rejected.status_code == 403
        assert (await a.get("/api/v1/auth/session")).status_code == 200


async def test_database_rejects_null_registration_type_without_api(authentication):
    _, service, clients, directory = authentication
    async with clients() as client:
        email, _, _ = await verified_login(client, directory)
        async with service.sessions() as session:
            account = await session.scalar(select(Account).where(Account.email_normalized == email))
            account_id, encoded = account.id, account.password_hash
        with pytest.raises(IntegrityError, match="ck_email_token_registration"):
            async with service.sessions.begin() as session:
                now = service.clock()
                session.add(
                    AuthEmailToken(
                        account_id=account_id,
                        purpose="verify_email",
                        token_digest=bytes(32),
                        created_at=now,
                        expires_at=now + auth.timedelta(seconds=15),
                        pending_password_hash=encoded,
                        pending_account_type=None,
                        pending_display_name="SQL绕过测试",
                    )
                )
                await session.flush()
