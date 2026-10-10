"""Explicitly enabled private HTTP worker integration; no public or business host execution."""

import asyncio
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, request_hash
from vault_backend.code_worker_client import CodeWorkerClient

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        sys.platform != "linux" or os.environ.get("VAULT_CODE_WORKER_HTTP_INTEGRATION") != "1",
        reason="requires an explicitly enabled private Linux worker and private token",
    ),
]


def client():
    return CodeWorkerClient("http://127.0.0.1:8091", os.environ["VAULT_CODE_WORKER_TOKEN"])


@pytest.mark.parametrize(
    "language,entry,source",
    [
        ("c17", "main.c", '#include <stdio.h>\nint main(){puts("42");}'),
        ("cpp17", "main.cpp", '#include <iostream>\nint main(){std::cout<<"42\\n";}'),
        (
            "java21",
            "Main.java",
            "public class Main {public static void main(String[] a){System.out.println(42);}}",
        ),
        (
            "python313",
            "main.py",
            'import os\nassert "VAULT_CODE_WORKER_TOKEN" not in os.environ\nprint(42)',
        ),
        ("node24", "main.js", "console.log(42)"),
    ],
)
async def test_private_transport_runs_real_code_and_binds_snapshot(language, entry, source):
    submission = CodeRequest(language=language, entry=entry, files={entry: source})
    result = await client().run(submission)
    assert result.status == "success" and result.stdout == "42\n", result
    assert result.request_sha256 == request_hash(submission)
    assert result.mastery_asserted is False
    assert not Path("/var/local/lib/isolate/700").exists()


async def test_transport_cancellation_reclaims_sandbox_and_reopens_admission():
    submission = CodeRequest(
        language="c17", entry="main.c", files={"main.c": "int main(){for(;;){}}"}
    )
    task = asyncio.create_task(client().run(submission))
    await asyncio.sleep(0.5)
    assert Path("/var/local/lib/isolate/700").exists()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    for _ in range(30):
        if not Path("/var/local/lib/isolate/700").exists():
            break
        await asyncio.sleep(0.1)
    assert not Path("/var/local/lib/isolate/700").exists()
    result = await client().run(
        CodeRequest(language="python313", entry="main.py", files={"main.py": "print(42)"})
    )
    assert result.status == "success" and result.stdout == "42\n", result
