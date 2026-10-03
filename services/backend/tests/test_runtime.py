import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import pytest


@pytest.mark.postgres
def test_command_entrypoint_can_reach_real_postgres():
    url = os.environ.get("VAULT_TEST_API_DATABASE_URL")
    if not url:
        pytest.skip("VAULT_TEST_API_DATABASE_URL is not set")
    assert os.environ.get("VAULT_TEST_DATABASE_IS_DISPOSABLE") == "1"
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    environment = {
        **os.environ,
        "VAULT_DATABASE_URL": url,
        "VAULT_ENVIRONMENT": "test",
        "VAULT_BIND_HOST": "127.0.0.1",
        "VAULT_PORT": str(port),
    }
    process = subprocess.Popen(
        [sys.executable, "-m", "vault_backend"],
        cwd=Path(__file__).resolve().parents[1],
        env=environment,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    payload = None
    try:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            assert process.poll() is None, "The actual API command exited before readiness"
            try:
                with urlopen(f"http://127.0.0.1:{port}/api/v1/health/ready", timeout=1) as reply:
                    payload = json.load(reply)
                break
            except HTTPError as error:
                payload = json.load(error)
            except (URLError, TimeoutError):
                pass
            time.sleep(0.05)
        assert payload and payload["database"] == "ready", payload
        assert payload["features"]["guest_trace"] is True
        assert payload["features"]["accounts"] is False
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
