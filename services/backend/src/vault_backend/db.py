from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


def create_engine(url: str) -> AsyncEngine:
    if not url.startswith("postgresql+psycopg://"):
        raise ValueError("Only PostgreSQL with psycopg is supported")
    return create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


async def database_ready(engine: AsyncEngine | None) -> bool:
    if engine is None:
        return False
    try:
        async with engine.connect() as connection:
            version = await connection.scalar(text("SELECT current_setting('server_version_num')"))
            revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
            return int(version) // 10000 == 18 and revision == "0011_code_draft"
    except Exception:
        return False
