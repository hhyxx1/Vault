"""Run a fresh PostgreSQL18 cluster inside each isolate, never the API database."""

import os
import sys

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
        reason="Linux PostgreSQL18 isolate required",
    ),
]


async def execute(sql):
    return await IsolateWorker().run(
        CodeRequest(language="postgres18", entry="main.sql", files={"main.sql": sql})
    )


async def test_real_postgres_null_bag_transaction_and_fresh_cluster():
    result = await execute(
        "CREATE TABLE example(x integer); INSERT INTO example VALUES (1),(1),(NULL); "
        "SELECT count(*),count(x),count(DISTINCT x) FROM example; "
        "BEGIN; INSERT INTO example VALUES (2); ROLLBACK; SELECT count(*) FROM example;"
    )
    assert (result.status, result.stdout, result.stderr) == ("success", "3|2|1\n3\n", ""), result
    fresh = await execute("SELECT to_regclass('workspace.example') IS NULL;")
    assert (fresh.status, fresh.stdout, fresh.stderr) == ("success", "t\n", ""), fresh


async def test_role_cannot_escalate_read_server_files_or_execute_programs():
    for sql in [
        "SET ROLE controller;",
        "SELECT pg_read_file('/etc/passwd');",
        "COPY (SELECT 1) TO PROGRAM 'id';",
        "CREATE ROLE elevated SUPERUSER;",
        "CREATE DATABASE elevated;",
    ]:
        result = await execute(sql)
        assert result.status == "runtime_error", result
        assert "ERROR" in result.stderr, result


async def test_sql_fault_and_timeout_do_not_poison_next_run():
    result = await execute(
        "CREATE TABLE positive(x integer CHECK(x>0)); INSERT INTO positive VALUES(-1);"
    )
    assert result.status == "runtime_error" and "check constraint" in result.stderr, result
    delayed = await execute("SELECT pg_sleep(20);")
    assert delayed.status == "runtime_error" and "statement timeout" in delayed.stderr, delayed
    repaired = await execute("SELECT 2+3;")
    assert (repaired.status, repaired.stdout, repaired.stderr) == ("success", "5\n", ""), repaired
