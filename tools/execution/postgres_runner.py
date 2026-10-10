"""Trusted, read-only runner copied into the dedicated PostgreSQL toolchain.

The entire cluster lives in /box, TCP is disabled, and every SQL job starts fresh.
This script is never learner supplied and never connects to the business database.
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path("/opt/vault-toolchains/pg18")
BIN = ROOT / "usr/lib/postgresql/18/bin"
DATA = Path("/box/pgdata")
ENV = {**os.environ, "LD_LIBRARY_PATH": str(ROOT / "usr/lib/x86_64-linux-gnu")}


def command(name, *args, **kwargs):
    return subprocess.run([str(BIN / name), *args], env=ENV, check=True, **kwargs)


def main():
    # Synthetic identity files contain this sandbox user only, never host accounts.
    Path("/etc/passwd").write_text(
        f"worker:x:{os.getuid()}:{os.getgid()}:Sandbox:/box:/bin/false\n"
    )
    Path("/etc/group").write_text(f"worker:x:{os.getgid()}:\n")
    Path("/etc/nsswitch.conf").write_text("passwd: files\ngroup: files\n")
    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    if "\\" in source:
        print("psql client commands are not accepted", file=sys.stderr)
        return 1
    started = False
    try:
        with Path("/box/tmp/prepare.log").open("wb") as log:
            command(
                "initdb",
                "-D",
                str(DATA),
                "-L",
                str(ROOT / "usr/share/postgresql/18"),
                "-U",
                "controller",
                "--auth-local=trust",
                "--auth-host=reject",
                "--no-sync",
                "--encoding=UTF8",
                "--locale=C",
                "--set=shared_buffers=8MB",
                "--set=max_connections=10",
                "--set=max_wal_size=32MB",
                "--set=min_wal_size=32MB",
                "--set=wal_buffers=64kB",
                "--set=max_files_per_process=64",
                "--set=dynamic_shared_memory_type=mmap",
                "--set=shared_memory_type=mmap",
                "--set=listen_addresses=",
                "--set=unix_socket_directories=/box/tmp",
                stdout=log,
                stderr=log,
            )
            command(
                "pg_ctl",
                "-D",
                str(DATA),
                "-l",
                "/box/tmp/server.log",
                "-w",
                "-t",
                "3",
                "start",
                stdout=log,
                stderr=log,
            )
            started = True
            command(
                "psql",
                "-X",
                "-q",
                "-h",
                "/box/tmp",
                "-U",
                "controller",
                "-d",
                "postgres",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                "CREATE ROLE learner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; "
                "REVOKE ALL ON DATABASE postgres FROM PUBLIC; "
                "GRANT CONNECT ON DATABASE postgres TO learner; "
                "REVOKE ALL ON SCHEMA public FROM PUBLIC; "
                "CREATE SCHEMA workspace AUTHORIZATION learner;",
                stdout=log,
                stderr=log,
            )
    except (OSError, subprocess.CalledProcessError):
        print("PostgreSQL sandbox initialization failed", file=sys.stderr)
        print(
            Path("/box/tmp/prepare.log").read_text(errors="replace")[-2048:],
            file=sys.stderr,
        )
        return 70
    try:
        environment = {
            **ENV,
            "PGOPTIONS": "-c search_path=workspace,pg_catalog -c statement_timeout=2000 -c lock_timeout=1000",
        }
        # Backslash is excluded, so this script cannot contain psql client commands.
        result = subprocess.run(
            [
                str(BIN / "psql"),
                "-X",
                "-qAt",
                "-h",
                "/box/tmp",
                "-U",
                "learner",
                "-d",
                "postgres",
                "-v",
                "ON_ERROR_STOP=1",
                "-P",
                "null=<NULL>",
                "-f",
                sys.argv[1],
            ],
            env=environment,
            check=False,
        )
        return 0 if result.returncode == 0 else 1
    finally:
        if started:
            with Path("/box/tmp/stop.log").open("wb") as log:
                command(
                    "pg_ctl",
                    "-D",
                    str(DATA),
                    "-m",
                    "immediate",
                    "-w",
                    "-t",
                    "3",
                    "stop",
                    stdout=log,
                    stderr=log,
                )


if __name__ == "__main__":
    sys.exit(main())
