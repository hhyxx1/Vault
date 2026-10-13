import json

import pytest

from vault_backend.course_checks.semantic_suites import compare_output


@pytest.mark.parametrize(
    "codes,bits,valid",
    [
        (["0", "1"], "01", True),
        (["1", "0"], "10", True),
        (["0", "01"], "001", False),
        (["0", "1"], "00", False),
        (["00", "11"], "0011", False),
        (["0", "0"], "00", False),
    ],
)
def test_huffman_accepts_equivalent_optimal_codes_and_rejects_invalid_works(codes, bits, valid):
    expected = json.dumps({"weights": [1, 1], "message": [0, 1], "optimal_cost": 2})
    observed = json.dumps({"codes": codes, "bits": bits})
    assert compare_output("huffman_codebook", expected, observed) == valid


def test_fixed_huffman_task_uses_the_same_semantic_comparator():
    from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
    from vault_backend.course_checks.code_tasks import assess_task, resolve_task
    from vault_backend.course_checks.cs03_linear import COURSE_VERSION

    task = resolve_task(COURSE_VERSION, "CS03-M05-O03", "base")
    request = CodeRequest(
        language="cpp17", entry="main.cpp", files={"main.cpp": "// authored work"}, stdin=task.stdin
    )
    result = CodeResult(
        status="success",
        phase="run",
        runtime_profile="cpp17-isolate",
        request_sha256=request_hash(request),
        stdout=json.dumps({"codes": ["00", "01", "10", "11"], "bits": "000110110011"}),
    )
    assert assess_task(task, request, result)["criteria"][0]["status"] == "met"
