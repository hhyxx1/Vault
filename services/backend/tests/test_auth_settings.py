import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from vault_backend import auth
from vault_backend.api import create_app
from vault_backend.config import Settings


def test_production_cannot_enable_capture_authentication(tmp_path):
    with pytest.raises(ValidationError, match="real mail adapter"):
        Settings(
            environment="production",
            guest_enabled=False,
            auth_enabled=True,
            database_url="postgresql+psycopg://test",
            mail_capture_dir=tmp_path,
        )


def test_authentication_requires_database_and_private_capture(tmp_path):
    with pytest.raises(ValidationError, match="requires PostgreSQL"):
        Settings(auth_enabled=True, database_url="", mail_capture_dir=tmp_path)
    with pytest.raises(ValidationError, match="private TEMP"):
        Settings(mail_capture_dir="C:/public-mail" if tmp_path.drive else "/public-mail")


async def test_disabled_authentication_is_explicit_503(settings):
    app = create_app(settings)
    app.state.auth = auth.AuthService(None, settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost:8000"
    ) as client:
        result = await client.post(
            "/api/v1/auth/nonce", headers={"Origin": "http://localhost:5173"}
        )
        assert result.status_code == 503
        assert result.json()["code"] == "AUTH_UNAVAILABLE"
