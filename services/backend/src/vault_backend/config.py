from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VAULT_", env_file=None, extra="ignore")
    environment: str = "development"
    database_url: str = ""
    course_catalog_path: Path = Path(__file__).resolve().parents[4] / "content/courses/catalog.json"
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
    )
    guest_idle_seconds: int = Field(default=1800, ge=1, le=7200)
    guest_absolute_seconds: int = Field(default=7200, ge=1, le=7200)
    guest_max_leases: int = Field(default=256, ge=1, le=10000)
    guest_max_operations: int = Field(default=20, ge=1, le=100)
    guest_max_streams: int = Field(default=64, ge=1, le=512)
    guest_streams_per_lease: int = Field(default=2, ge=1, le=4)
    guest_enabled: bool = True
    max_request_bytes: int = Field(default=65536, ge=4096, le=1048576)
    auth_enabled: bool = False
    mail_capture_dir: Path | None = None
    auth_idle_seconds: int = Field(default=86400, ge=1, le=86400)
    auth_absolute_seconds: int = Field(default=604800, ge=1, le=604800)
    auth_email_token_seconds: int = Field(default=1800, ge=1, le=86400)
    auth_nonce_seconds: int = Field(default=300, ge=1, le=600)

    @model_validator(mode="after")
    def validate_runtime(self):
        if self.database_url and not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("VAULT_DATABASE_URL must use postgresql+psycopg")
        if self.environment not in {"development", "test", "production"}:
            raise ValueError("Unknown environment")
        if self.environment == "production" and self.guest_enabled:
            raise ValueError("Guest service needs cleanup/privacy acceptance before production")
        if self.environment == "production" and self.auth_enabled:
            raise ValueError("Authentication requires a real mail adapter before production")
        if self.auth_enabled and (not self.database_url or self.mail_capture_dir is None):
            raise ValueError("Authentication requires PostgreSQL and private mail capture")
        if self.mail_capture_dir is not None:
            import tempfile

            capture = self.mail_capture_dir.resolve()
            temporary = Path(tempfile.gettempdir()).resolve()
            if capture == temporary or not capture.is_relative_to(temporary):
                raise ValueError("Development mail capture must use a private TEMP subdirectory")
            self.mail_capture_dir = capture
        if not self.allowed_origins or "*" in self.allowed_origins:
            raise ValueError("Explicit same-site origins are required")
        return self
