"""Opt-in tests run only on the isolated Linux development worker, never Windows."""

import asyncio
import os
import socket
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
        reason="requires an explicitly enabled Linux isolate worker",
    ),
]


async def test_c_compilation_and_real_stdin():
    result = await IsolateWorker().run(
        CodeRequest(
            language="c17",
            entry="main.c",
            files={
                "main.c": '#include <stdio.h>\nint main(){int a,b;scanf("%d%d",&a,&b);'
                'printf("%d\\n",a+b);}'
            },
            stdin="2 3",
        )
    )
    assert result.status == "success", result
    assert result.stdout == "5\n"
    assert not Path("/var/local/lib/isolate/700").exists()


async def test_cpp_multiple_files_and_header():
    result = await IsolateWorker().run(
        CodeRequest(
            language="cpp17",
            entry="main.cpp",
            files={
                "main.cpp": '#include <iostream>\n#include "helper.hpp"\n'
                "int main(){std::cout<<answer();}",
                "helper.hpp": "int answer();",
                "helper.cpp": "int answer(){return 42;}",
            },
        )
    )
    assert result.status == "success", result
    assert result.stdout == "42"


async def test_compile_error_and_runtime_error_are_distinct():
    worker = IsolateWorker()
    broken = await worker.run(
        CodeRequest(language="c17", entry="main.c", files={"main.c": "syntax error"})
    )
    assert broken.status == "compile_error" and broken.phase == "compile", broken
    failing = await worker.run(
        CodeRequest(language="c17", entry="main.c", files={"main.c": "int main(){return 3;}"})
    )
    assert failing.status == "runtime_error" and failing.phase == "run", failing


async def test_timeout_and_cancel_reclaim_every_box():
    request = CodeRequest(
        language="c17", entry="main.c", files={"main.c": "int main(){for(;;){};}"}
    )
    result = await IsolateWorker().run(request)
    assert result.status == "timeout", result
    task = asyncio.create_task(IsolateWorker().run(request))
    await asyncio.sleep(0.5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not Path("/var/local/lib/isolate/700").exists()


async def test_source_cannot_read_controller_files_or_environment(tmp_path):
    marker = tmp_path / "private-marker"
    marker.write_text("dummy-secret", encoding="utf-8")
    os.environ["VAULT_TEST_PRIVATE_MARKER"] = "dummy-secret"
    try:
        source = (
            "#include <stdio.h>\n#include <stdlib.h>\nint main(){"
            f'FILE *f=fopen("{marker}","r");'
            'if(f || getenv("VAULT_TEST_PRIVATE_MARKER")) return 1; puts("isolated");}'
        )
        result = await IsolateWorker().run(
            CodeRequest(language="c17", entry="main.c", files={"main.c": source})
        )
        assert result.status == "success" and result.stdout == "isolated\n", result
    finally:
        os.environ.pop("VAULT_TEST_PRIVATE_MARKER", None)


async def test_python_version_input_and_no_network():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        port = listener.getsockname()[1]
        source = (
            "import sys, socket\nassert sys.version_info[:2] == (3, 13)\n"
            "s = socket.socket(); s.settimeout(0.5)\n"
            f'assert s.connect_ex(("127.0.0.1", {port})) != 0\n'
            "print(int(input()) * 2)\n"
        )
        result = await IsolateWorker().run(
            CodeRequest(
                language="python313", entry="main.py", files={"main.py": source}, stdin="21\n"
            )
        )
    assert result.status == "success" and result.stdout == "42\n", result


@pytest.mark.parametrize(
    "language,entry,source",
    [
        (
            "java21",
            "Main.java",
            "public class Main {public static void main(String[] a) {"
            "if(Runtime.version().feature()!=21) throw new AssertionError();"
            " System.out.println(42);}}",
        ),
        (
            "node24",
            "main.js",
            'if(process.versions.node.split(".")[0]!=="24") throw Error("version");'
            " console.log(42);",
        ),
    ],
)
async def test_required_language_version_executes(language, entry, source):
    result = await IsolateWorker().run(
        CodeRequest(language=language, entry=entry, files={entry: source})
    )
    assert result.status == "success" and result.stdout == "42\n", result


async def test_missing_isolate_never_falls_back_to_host_execution(tmp_path):
    worker = IsolateWorker()
    worker.isolate = str(tmp_path / "missing-isolate")
    result = await worker.run(
        CodeRequest(language="python313", entry="main.py", files={"main.py": "print(1)"})
    )
    assert result.status == "environment_error" and result.phase == "prepare"


async def test_file_limit_is_classified_and_scratch_is_reclaimed():
    source = (
        '#include <stdio.h>\nint main(){FILE *f=fopen("large","w");'
        "for(int i=0;i<2000000;i++) fputc(65,f); fclose(f);}"
    )
    result = await IsolateWorker().run(
        CodeRequest(
            language="c17",
            entry="main.c",
            files={"main.c": source},
        )
    )
    assert result.status == "resource_limit", result
    assert not Path("/var/local/lib/isolate/700").exists()


async def test_tmp_and_working_directory_share_a_bounded_disk():
    source = (
        "import errno\ncount=0\ntry:\n"
        " while True:\n"
        '  with open("/tmp/f"+str(count), "wb") as f: f.write(b"x"*65536)\n'
        "  count+=1\n"
        "except OSError as e:\n"
        " assert e.errno == errno.ENOSPC\n assert 0 < count < 256\n"
        ' print("bounded")\n'
    )
    result = await IsolateWorker().run(
        CodeRequest(
            language="python313",
            entry="main.py",
            files={"main.py": source},
        )
    )
    assert result.status == "success" and result.stdout == "bounded\n", result
    assert not Path("/var/local/lib/isolate/700").exists()
