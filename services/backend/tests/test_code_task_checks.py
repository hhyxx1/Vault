from uuid import uuid4

import pytest

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
from vault_backend.course_checks.code_tasks import assess_task, resolve_task
from vault_backend.errors import ApiError

VERSION = "ad970167-0230-5141-8027-cc535f3ed22e"


def sample(stdout="5\n", status="success", stdin=""):
    request = CodeRequest(
        language="c17", entry="main.c", files={"main.c": "int main(void){return 0;}"}, stdin=stdin
    )
    return request, CodeResult(
        status=status,
        phase="run",
        stdout=stdout,
        runtime_profile="test",
        request_sha256=request_hash(request),
    )


def test_fixed_task_compares_semantics_without_claiming_independence():
    task = resolve_task(VERSION, "CS01-M01-O02", "base")
    request, result = sample("23\n")
    feedback = assess_task(task, request, result)
    assert feedback["criteria"][0]["status"] == "not_met"
    assert feedback["mastery_asserted"] is False
    feedback = assess_task(task, *sample())
    assert [c["status"] for c in feedback["criteria"]] == ["met", "needs_review", "needs_review"]
    assert feedback["provenance"] == "server_deterministic_checker"
    assert feedback["standard_version"] == "cs01-fixed-condition-v1"


def test_incomplete_or_changed_conditions_are_not_false_failures():
    task = resolve_task(VERSION, "CS01-M01-O02", "base")
    for request, result in [sample(status="environment_error"), sample(stdin="changed")]:
        assert assess_task(task, request, result)["criteria"][0]["status"] == "needs_review"
    request, result = sample()
    assert (
        assess_task(task, request, result.model_copy(update={"truncated": True}))["criteria"][0][
            "status"
        ]
        == "needs_review"
    )
    assert (
        assess_task(task, request, result.model_copy(update={"request_sha256": "0" * 64}))[
            "criteria"
        ][0]["status"]
        == "needs_review"
    )


def test_registered_expected_error_is_a_valid_observation():
    task = resolve_task(VERSION, "CS01-M01-O03", "input-empty")
    request, result = sample("", "runtime_error")
    result.stderr = "expected A\n"
    assert assess_task(task, request, result)["criteria"][0]["status"] == "met"


def test_clients_cannot_choose_an_unregistered_standard_or_goal():
    for version, goal, variant in [
        (str(uuid4()), "CS01-M01-O02", "base"),
        (VERSION, "MISSING", "base"),
        (VERSION, "CS01-M01-O02", "MISSING"),
    ]:
        with pytest.raises(ApiError):
            resolve_task(version, goal, variant)


def test_new_activity_version_does_not_accept_the_previous_activity_identity():
    with pytest.raises(ApiError):
        resolve_task(
            "93d59075-447d-55d5-a54b-d151c0aaa2a1",
            "CS01-M01-O02",
            "base",
            "07fe337c-cafd-550c-ac1c-4ac964b005f6",
        )
