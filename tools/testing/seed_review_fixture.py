"""Seed an isolated, verified review teacher for the browser E2E flow.

Registered teachers start unverified, and no UI promotes them (verification is an
administrative process). The browser E2E therefore uses this isolated fixture:
it creates a clearly labelled test teacher only in a local vault_e2e_* database.
The environment must explicitly be test, and an ephemeral password must be
provided through VAULT_E2E_TEACHER_PASSWORD. It refuses development databases.

Run through tools/testing/run_review_e2e.ps1 on Windows.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
from argon2 import PasswordHasher, Type

DEFAULT_EMAIL = "review-verified-teacher@invalid.test"
DEFAULT_PASSWORD = os.environ.get("VAULT_E2E_TEACHER_PASSWORD", "")
HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1, type=Type.ID)


def dsn() -> str:
    url = os.environ.get("VAULT_DATABASE_URL", "")
    if not url:
        raise SystemExit("VAULT_DATABASE_URL is not set")
    target = urlsplit(url)
    if (os.environ.get("VAULT_ENVIRONMENT") != "test"
            or target.hostname not in {"localhost", "127.0.0.1"}
            or not target.path.startswith("/vault_e2e_")):
        raise SystemExit("Fixture requires test mode and an isolated local vault_e2e_* database")
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--name", default="隔离测试教师")
    args = parser.parse_args()
    if not args.password:
        raise SystemExit("Set VAULT_E2E_TEACHER_PASSWORD to an ephemeral fixture password")

    encoded = HASHER.hash(args.password)
    now = datetime.now(UTC)
    with psycopg.connect(dsn()) as conn:
        row = conn.execute(
            "SELECT id FROM account WHERE email_normalized = %s", (args.email,)
        ).fetchone()
        if row is None:
            account_id = uuid4()
            conn.execute(
                "INSERT INTO account "
                "(id,account_type,email_normalized,email_display,password_hash) "
                "VALUES (%s,'teacher',%s,%s,%s)",
                (account_id, args.email, args.email, encoded),
            )
            conn.execute(
                "INSERT INTO account_auth_state (account_id,email_verified_at) VALUES (%s,%s)",
                (account_id, now),
            )
            conn.execute(
                "INSERT INTO teacher_profile (account_id,display_name,verification_state) "
                "VALUES (%s,%s,'verified')",
                (account_id, args.name),
            )
        else:
            account_id = row[0]
            conn.execute(
                "UPDATE account SET account_type='teacher', password_hash=%s WHERE id=%s",
                (encoded, account_id),
            )
            conn.execute(
                "INSERT INTO account_auth_state (account_id,email_verified_at) VALUES (%s,%s) "
                "ON CONFLICT (account_id) DO UPDATE SET email_verified_at = EXCLUDED.email_verified_at",
                (account_id, now),
            )
            conn.execute(
                "INSERT INTO teacher_profile (account_id,display_name,verification_state) "
                "VALUES (%s,%s,'verified') "
                "ON CONFLICT (account_id) DO UPDATE SET display_name = EXCLUDED.display_name, "
                "verification_state = 'verified'",
                (account_id, args.name),
            )
        conn.commit()
    print(f"seeded verified teacher fixture: {args.email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
