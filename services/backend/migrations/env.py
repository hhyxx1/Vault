import asyncio
import os

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from vault_backend.models import Base

config = context.config
target_metadata = Base.metadata


def database_url():
    url = os.environ.get("VAULT_DATABASE_URL", "")
    if not url.startswith("postgresql+psycopg://"):
        raise RuntimeError("Set VAULT_DATABASE_URL to a PostgreSQL psycopg URL")
    return url


def run_migrations_offline():
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def sync_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def async_migrations():
    engine = create_async_engine(database_url(), poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(sync_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(async_migrations(), loop_factory=asyncio.SelectorEventLoop)
