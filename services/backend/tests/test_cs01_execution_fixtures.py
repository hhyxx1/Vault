"""Authoring checks are not student mastery checks or published course readiness."""

import json
import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures/course-code/CS01-M01.json"
PUBLIC = (
    Path(__file__).resolve().parents[3]
    / "content/courses/CS01/CS01-core-practice-0.1.0/manifest.json"
)


def load_cases():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_cs01_initial_module_has_controlled_good_bad_and_changed_input_cases():
    cases = load_cases()
    assert {case["id"] for case in cases} == {
        "missing-semicolon",
        "hello-fixed",
        "wrong-output",
        "nonzero-exit",
        "input-accepted",
        "input-rejected",
        "input-empty",
    }
    for case in cases:
        request = CodeRequest.model_validate(case["request"])
        assert request.language == "c17"
        assert case["goal"] in {"CS01-M01-O01", "CS01-M01-O02", "CS01-M01-O03"}
    assert {case["expected"]["status"] for case in cases} == {
        "success",
        "compile_error",
        "runtime_error",
    }


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires the dedicated Linux authoring execution worker",
)
async def test_cs01_authored_cases_have_reproducible_actual_results():
    for case in load_cases():
        result = await IsolateWorker().run(CodeRequest.model_validate(case["request"]))
        for field, expected in case["expected"].items():
            assert getattr(result, field) == expected, (case["id"], field, result)
        assert result.mastery_asserted is False


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ISOLATE_INTEGRATION") != "1",
    reason="requires the dedicated Linux authoring execution worker",
)
async def test_public_starters_answers_and_variants_have_actual_declared_outcomes():
    package = json.loads(PUBLIC.read_text(encoding="utf-8"))
    expectations = {
        "CS01-M01-O01": ("compile_error", None, "Hello, learner!\n"),
        "CS01-M01-O02": ("success", "23\n", "5\n"),
        "CS01-M01-O03": ("success", "accepted\n", "accepted\n"),
    }
    variants = {
        "wrong-output": ("success", "23\n", ""),
        "nonzero-exit": ("runtime_error", "Hello, learner!\n", ""),
        "input-rejected": ("runtime_error", "", "expected A\n"),
        "input-empty": ("runtime_error", "", "expected A\n"),
    }
    ready = [a for a in package["activities"] if a["availability"] == "practice_ready"]
    assert len(ready) == 3
    for activity in ready:
        status, stdout, answer_stdout = expectations[activity["objective_codes"][0]]
        for request, expected_status, expected_stdout, expected_stderr in [
            (activity["code_request"], status, stdout, ""),
            (activity["reference_answer"], "success", answer_stdout, ""),
            *[
                (variant["code_request"], *variants[variant["code"]])
                for variant in activity["variants"]
            ],
        ]:
            result = await IsolateWorker().run(CodeRequest.model_validate(request))
            assert result.status == expected_status
            if expected_stdout is not None:
                assert result.stdout == expected_stdout
                assert result.stderr == expected_stderr
            assert result.mastery_asserted is False
