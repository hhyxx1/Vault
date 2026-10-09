import os
from uuid import uuid4

import psycopg
import pytest
from sqlalchemy import text

from vault_backend.db import create_engine, database_ready

pytestmark = pytest.mark.postgres


def pg_url():
    url = os.environ.get("VAULT_TEST_DATABASE_URL", "")
    if not url:
        pytest.skip("VAULT_TEST_DATABASE_URL is not set; PostgreSQL integration not tested")
    if os.environ.get("VAULT_TEST_DATABASE_IS_DISPOSABLE") != "1":
        raise pytest.UsageError("PostgreSQL tests require VAULT_TEST_DATABASE_IS_DISPOSABLE=1")
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture
def db():
    with psycopg.connect(pg_url()) as connection:
        assert (
            connection.execute("SELECT current_setting('server_version_num')")
            .fetchone()[0]
            .startswith("18")
        )
        assert (
            connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "0008_course_attempt"
        )
        # All synthetic mutations remain in one transaction and are rolled back.
        yield connection
        connection.rollback()


def account(connection, account_type="student"):
    key = uuid4()
    connection.execute(
        "INSERT INTO account (id,account_type,email_normalized,email_display,password_hash) "
        "VALUES (%s,%s,%s,%s,'synthetic-not-login')",
        (key, account_type, f"{key}@invalid.test", f"{key}@invalid.test"),
    )
    return key


def space(connection, owner):
    key = uuid4()
    connection.execute(
        "INSERT INTO learning_space (id,owner_account_id) VALUES (%s,%s)", (key, owner)
    )
    return key


def artifact(connection, space_id):
    key = uuid4()
    connection.execute(
        "INSERT INTO artifact (id,space_id,title) VALUES (%s,%s,'synthetic')", (key, space_id)
    )
    return key


def revision(connection, space_id, artifact_id, parent=None):
    key = uuid4()
    connection.execute(
        "INSERT INTO artifact_version "
        "(id,space_id,artifact_id,parent_revision_id,content_hash,content,author_source) "
        "VALUES (%s,%s,%s,%s,%s,'{}','student')",
        (key, space_id, artifact_id, parent, bytes(32)),
    )
    return key


def set_context(connection, account_id):
    connection.execute("SELECT set_config('vault.account_id', %s, true)", (str(account_id),))


def test_profile_type_cannot_be_forged(db):
    student = account(db)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with db.transaction():
            db.execute(
                "INSERT INTO teacher_profile (account_id,display_name) VALUES (%s,'wrong')",
                (student,),
            )


def test_artifact_and_parent_scope_foreign_keys(db):
    owner = account(db)
    a, b = space(db, owner), space(db, owner)
    art_a, art_b = artifact(db, a), artifact(db, b)
    rev_a = revision(db, a, art_a)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with db.transaction():
            revision(db, a, art_b)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with db.transaction():
            revision(db, b, art_b, rev_a)


def test_current_revision_cannot_point_to_another_artifact(db):
    owner = account(db)
    a, b = space(db, owner), space(db, owner)
    art_a, art_b = artifact(db, a), artifact(db, b)
    rev_b = revision(db, b, art_b)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with db.transaction():
            db.execute("UPDATE artifact SET current_revision_id=%s WHERE id=%s", (rev_b, art_a))
            db.execute("SET CONSTRAINTS fk_artifact_current_revision IMMEDIATE")


def test_private_rls_denies_no_context_and_cross_owner(db):
    a, b = account(db), account(db)
    space_a, space_b = space(db, a), space(db, b)
    artifact(db, space_a)
    artifact(db, space_b)
    db.execute("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO vault_api")
    db.execute("SET LOCAL ROLE vault_api")
    assert db.execute(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user"
    ).fetchone() == (False, False)
    assert db.execute("SELECT id FROM learning_space").fetchall() == []
    set_context(db, a)
    assert db.execute("SELECT id FROM learning_space").fetchall() == [(space_a,)]
    assert db.execute("SELECT count(*) FROM artifact").fetchone()[0] == 1
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with db.transaction():
            artifact(db, space_b)
    set_context(db, b)
    assert db.execute("SELECT id FROM learning_space").fetchall() == [(space_b,)]
    db.execute("RESET ROLE")


def test_agent_run_is_account_scoped_and_checkpoint_is_not_authority(db):
    a, b = account(db), account(db)
    a_space, b_space = space(db, a), space(db, b)
    run = uuid4()
    db.execute("GRANT SELECT,INSERT,UPDATE,DELETE ON agent_run TO vault_api")
    db.execute("SET LOCAL ROLE vault_api")
    assert db.execute("SELECT id FROM agent_run").fetchall() == []
    set_context(db, a)
    db.execute(
        "INSERT INTO agent_run "
        "(id,space_id,owner_account_id,activity_version,artifact_id,revision_id,graph_version) "
        "VALUES (%s,%s,%s,'activity@1',%s,%s,'graph@1')",
        (run, a_space, a, uuid4(), uuid4()),
    )
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with db.transaction():
            db.execute(
                "INSERT INTO agent_run "
                "(id,space_id,owner_account_id,activity_version,"
                "artifact_id,revision_id,graph_version) "
                "VALUES (%s,%s,%s,'activity@1',%s,%s,'graph@1')",
                (uuid4(), b_space, a, uuid4(), uuid4()),
            )
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.transaction():
            db.execute("UPDATE agent_run SET call_budget=100 WHERE id=%s", (run,))
    db.execute("UPDATE agent_run SET status='waiting',calls_used=1 WHERE id=%s", (run,))
    set_context(db, b)
    assert db.execute("SELECT id FROM agent_run").fetchall() == []
    assert db.execute("UPDATE agent_run SET status='completed' WHERE id=%s", (run,)).rowcount == 0
    db.execute("RESET ROLE")


def test_binding_and_versions_are_immutable(db):
    a, b = account(db), account(db)
    space_a = space(db, a)
    art_a = artifact(db, space_a)
    rev_a = revision(db, space_a, art_a)
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.transaction():
            db.execute("UPDATE learning_space SET owner_account_id=%s WHERE id=%s", (b, space_a))
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.transaction():
            db.execute("UPDATE artifact_version SET content='{}' WHERE id=%s", (rev_a,))


def test_claim_requires_same_space_owner(db):
    a, b = account(db), account(db)
    space_a = space(db, a)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with db.transaction():
            db.execute(
                "INSERT INTO sync_claim (claim_id,expected_account_id,origin_local_space_id,"
                "server_space_id,manifest_hash) VALUES (%s,%s,%s,%s,%s)",
                (uuid4(), b, uuid4(), space_a, bytes(32)),
            )


async def test_async_psycopg_and_pool_context_does_not_leak():
    url = os.environ.get("VAULT_TEST_API_DATABASE_URL", "")
    if not url:
        pytest.skip("VAULT_TEST_API_DATABASE_URL is not set")
    engine = create_engine(url)
    try:
        assert await database_ready(engine)
        async with engine.begin() as connection:
            actor = str(uuid4())
            await connection.execute(
                text("SELECT set_config('vault.account_id', :actor, true)"), {"actor": actor}
            )
            assert (
                await connection.scalar(text("SELECT current_setting('vault.account_id',true)"))
                == actor
            )
        async with engine.begin() as connection:
            assert (
                await connection.scalar(
                    text("SELECT nullif(current_setting('vault.account_id',true),'')")
                )
                is None
            )
            assert await connection.scalar(text("SELECT count(*) FROM learning_space")) == 0
    finally:
        await engine.dispose()


async def test_guest_body_never_creates_permanent_profile(settings, trace_payload):
    from httpx import ASGITransport, AsyncClient

    from vault_backend.api import create_app

    counts_before = {}
    with psycopg.connect(pg_url()) as connection:
        for table in (
            "account",
            "learning_space",
            "artifact",
            "artifact_version",
            "verification_event",
        ):
            counts_before[table] = connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
    app = create_app(settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost:5173"
    ) as client:
        nonce = (await client.get("/api/v1/guest-nonce")).json()["nonce"]
        lease = (
            await client.post(
                "/api/v1/guest-leases",
                headers={"Origin": "http://localhost:5173"},
                json={"nonce": nonce},
            )
        ).json()
        response = await client.post(
            f"/api/v1/guest-leases/{lease['lease_id']}/operations",
            headers={
                "Origin": "http://localhost:5173",
                "Authorization": f"GuestLease {lease['token']}",
                "Idempotency-Key": str(uuid4()),
            },
            json=trace_payload,
        )
        assert response.status_code == 201
    with psycopg.connect(pg_url()) as connection:
        for table, count in counts_before.items():
            assert connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0] == count


def test_published_version_cannot_reopen_or_modify_objectives(db):
    course_id, version_id, objective_id = uuid4(), uuid4(), uuid4()
    db.execute(
        "INSERT INTO course(id,origin_kind,baseline_code,title) "
        "VALUES (%s,'platform_default',%s,'synthetic')",
        (course_id, str(course_id)[:32]),
    )
    db.execute(
        "INSERT INTO course_version(id,course_id,version_no,content_hash,scope) "
        "VALUES (%s,%s,1,%s,'{}')",
        (version_id, course_id, bytes(32)),
    )
    db.execute(
        "INSERT INTO learning_objective "
        "(id,course_version_id,code,statement,necessary_criteria) "
        "VALUES (%s,%s,'test-objective','original','[]')",
        (objective_id, version_id),
    )
    db.execute(
        "UPDATE course_version SET workflow_state='published',review_state='reviewed' WHERE id=%s",
        (version_id,),
    )
    for statement, params in [
        ("UPDATE course_version SET workflow_state='draft' WHERE id=%s", (version_id,)),
        ("UPDATE course_version SET scope='{\"changed\":true}' WHERE id=%s", (version_id,)),
        ("UPDATE course_version SET content_hash=%s WHERE id=%s", (bytes([1]) * 32, version_id)),
        ("UPDATE learning_objective SET statement='changed' WHERE id=%s", (objective_id,)),
        (
            "UPDATE learning_objective SET necessary_criteria='[\"changed\"]' WHERE id=%s",
            (objective_id,),
        ),
        ("DELETE FROM learning_objective WHERE id=%s", (objective_id,)),
        (
            "INSERT INTO learning_objective "
            "(id,course_version_id,code,statement,necessary_criteria) "
            "VALUES (%s,%s,'late-objective','late','[]')",
            (uuid4(), version_id),
        ),
    ]:
        with pytest.raises(psycopg.errors.CheckViolation):
            with db.transaction():
                db.execute(statement, params)
    db.execute("UPDATE course_version SET workflow_state='withdrawn' WHERE id=%s", (version_id,))
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.transaction():
            db.execute(
                "UPDATE course_version SET workflow_state='review' WHERE id=%s", (version_id,)
            )


def test_publication_lock_serializes_objective_edits():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from time import sleep

    course_id, version_id, objective_id = uuid4(), uuid4(), uuid4()
    with psycopg.connect(pg_url()) as setup:
        setup.execute(
            "INSERT INTO course (id,origin_kind,baseline_code,title) "
            "VALUES (%s,'platform_default',%s,'concurrency-synthetic')",
            (course_id, str(course_id)[:32]),
        )
        setup.execute(
            "INSERT INTO course_version (id,course_id,version_no,content_hash,scope) "
            "VALUES (%s,%s,1,%s,'{}')",
            (version_id, course_id, bytes(32)),
        )
        setup.execute(
            "INSERT INTO learning_objective "
            "(id,course_version_id,code,statement,necessary_criteria) "
            "VALUES (%s,%s,'concurrent-objective','original','[]')",
            (objective_id, version_id),
        )
    started = Event()

    def edit_after_publisher_locked():
        with psycopg.connect(pg_url()) as editor:
            editor.execute("SET LOCAL statement_timeout = '3s'")
            started.set()
            with pytest.raises(psycopg.errors.CheckViolation):
                with editor.transaction():
                    editor.execute(
                        "UPDATE learning_objective SET statement='late' WHERE id=%s",
                        (objective_id,),
                    )
            editor.rollback()
            return True

    with psycopg.connect(pg_url()) as publisher:
        publisher.execute("SELECT id FROM course_version WHERE id=%s FOR UPDATE", (version_id,))
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(edit_after_publisher_locked)
            assert started.wait(2)
            sleep(0.1)
            assert not future.done(), "Objective edit must wait for publication's parent lock"
            publisher.execute(
                "UPDATE course_version SET workflow_state='published',"
                "review_state='reviewed' WHERE id=%s",
                (version_id,),
            )
            publisher.commit()
            assert future.result(timeout=4)
        assert (
            publisher.execute(
                "SELECT statement FROM learning_objective WHERE id=%s", (objective_id,)
            ).fetchone()[0]
            == "original"
        )
    # Synthetic rows remain in the explicitly disposable integration database;
    # migration roundtrip clears them. No production database may run these tests.
