from pathlib import Path

import pytest
from pydantic import ValidationError

from vault_backend.code_execution import CodeRequest, execution_status, read_output, request_hash


def test_source_names_cannot_escape_or_become_compiler_options():
    for name in ("../main.c", "/tmp/main.c", "-fplugin.c", "a/../../main.c", "main.c\x00"):
        with pytest.raises(ValidationError):
            CodeRequest(language="c17", files={name: "int main(){}"}, entry=name)
    assert CodeRequest(language="c17", files={"main.c": "int main(){}"}, entry="main.c")


def test_execution_faults_are_not_student_failures():
    assert execution_status({"status": "XX"}, 2) == "environment_error"
    assert execution_status({}, 2) == "environment_error"
    assert execution_status({"status": "TO"}, 1) == "timeout"
    assert execution_status({"cg-oom-killed": "1", "status": "SG"}, 1) == "resource_limit"
    assert execution_status({"exitcode": "0"}, 0) == "success"
    assert execution_status({"exitcode": "1", "status": "RE"}, 1) == "runtime_error"


def test_output_is_bounded_and_never_follows_links(tmp_path: Path):
    output = tmp_path / "stdout"
    output.write_bytes(b"x" * 100)
    text, truncated = read_output(output, 16)
    assert text == "x" * 16 and truncated
    if hasattr(__import__("os"), "O_NOFOLLOW"):
        link = tmp_path / "link"
        link.symlink_to(output)
        with pytest.raises(OSError):
            read_output(link, 16)


def test_request_hash_binds_files_language_entry_and_input():
    request = CodeRequest(
        language="c17", files={"main.c": "int main(){}", "a.h": ""}, entry="main.c", stdin="1"
    )
    reordered = request.model_copy(update={"files": {"a.h": "", "main.c": "int main(){}"}})
    assert request_hash(request) == request_hash(reordered)
    assert request_hash(request) != request_hash(request.model_copy(update={"stdin": "2"}))
    assert request_hash(request) != request_hash(request.model_copy(update={"entry": "a.h"}))
    assert request_hash(request) != request_hash(request.model_copy(update={"language": "cpp17"}))
    assert request_hash(request) != request_hash(
        request.model_copy(update={"files": {"main.c": ""}})
    )
