"""C02 semantic verification: multiple inputs, independent oracle, alternative
solutions, two classes of meaningful errors, anti-hardcoding and infra safety."""

import asyncio
from uuid import UUID, uuid4

import pytest

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
from vault_backend.course_checks import semantic_suites as ss
from vault_backend.errors import ApiError
from vault_backend.guests import GuestLeaseStore
from vault_backend.schemas import CodeSubmission, CodeSuiteRef

COURSE = "7ca20169-02d2-5719-b3f0-eff208ae89db"
OBJECTIVE = "CS01-M03-O03"
ACTIVITY = "256601b5-be28-5e49-8a78-d8f39b8f48b4"


def fee(minutes: int) -> int:
    return 0 if minutes <= 30 else 5 if minutes <= 60 else 10


def make_code(language: str = "c17", entry: str = "main.c") -> CodeRequest:
    return CodeRequest(language=language, entry=entry, files={entry: "// student work"})


def runner_from(behavior):
    """behavior(stdin)->(status, stdout, phase, truncated)."""

    async def run(request: CodeRequest) -> CodeResult:
        status, stdout, phase, truncated = behavior(request.stdin)
        return CodeResult(
            status=status,
            phase=phase,
            stdout=stdout,
            truncated=truncated,
            runtime_profile="c17-isolate-dev@0.1.0",
            request_sha256=request_hash(request),
        )

    return run


def correct_behavior(padding: str = "{}"):
    def behavior(stdin):
        return "success", padding.format(fee(int(stdin.strip()))) + "\n", "run", False

    return behavior


def fixed_status(result, criterion="fixed_condition"):
    return next(c for c in result["criteria"] if c["id"] == criterion)["status"]


def case(result, code):
    return next(c for c in result["cases"] if c["case_code"] == code)


def independents(result):
    return [c for c in result["cases"] if c["kind"] == "independent"]


# --- comparators -------------------------------------------------------------


def test_comparators_accept_alternative_correct_presentations():
    assert ss.compare_output("exact", "a b\n", "a b\n")
    assert not ss.compare_output("exact", "a b\n", "a  b\n")
    # integer ignores surrounding whitespace / an alternate but valid format
    assert ss.compare_output("integer", "5\n", " 5 \n")
    assert not ss.compare_output("integer", "5\n", "5.0\n")
    assert not ss.compare_output("integer", "5\n", "not-a-number")
    assert ss.compare_output("number_tol", "0.1\n", "0.1000000001\n", tolerance=1e-6)
    # order-insensitive, multiplicity-aware / set / sorted-line comparisons
    assert ss.compare_output("token_multiset", "1 2 2\n", "2 1 2\n")
    assert not ss.compare_output("token_multiset", "1 2\n", "1 2 2\n")
    assert ss.compare_output("line_set", "a\nb\n", "b\na\n")
    assert ss.compare_output("sorted_lines", "1\n2\n2\n", "2\n1\n2\n")
    assert not ss.compare_output("sorted_lines", "1\n2\n", "1\n2\n2\n")
    with pytest.raises(ValueError):
        ss.compare_output("unknown", "x", "y")  # type: ignore[arg-type]


# --- registry / visibility ---------------------------------------------------


def test_independent_cases_are_never_listed_as_visible():
    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    assert ss.visible_case_stdins(suite) == ["30\n", "60\n"]
    assert all(case.kind == "visible" for case in suite.visible_cases)
    assert {case.stdin for case in suite.independent_cases} >= {"31\n", "61\n", "120\n"}


def test_unknown_suite_and_version_mismatch_are_404():
    with pytest.raises(ApiError) as exc:
        ss.get_suite(COURSE, "CS01-M99-O99")
    assert exc.value.status == 404 and exc.value.code == "SEMANTIC_SUITE_UNAVAILABLE"
    with pytest.raises(ApiError) as exc:
        ss.get_suite(COURSE, OBJECTIVE, "wrong-activity-version")
    assert exc.value.status == 404


# --- aggregate assessment ----------------------------------------------------


async def test_correct_general_program_passes_visible_and_independent_inputs():
    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    result = await ss.run_suite(runner_from(correct_behavior()), make_code(), suite)
    assert result["standard_version"] == ss.STANDARD
    assert result["provenance"] == "server_deterministic_checker"
    assert result["suspected_hardcoding"] is False
    assert fixed_status(result) == "met"
    assert all(c["status"] == "met" for c in result["cases"])
    assert result["mastery_asserted"] is False
    assert fixed_status(result, "explanation") == "needs_review"
    assert fixed_status(result, "independent_transfer") == "needs_review"
    # Independent inputs are redacted server-side: no stdin, expected answer,
    # observed output or revealing case code may leak into the public result.
    assert len(independents(result)) == 6
    assert all(
        c["stdin"] is None and c["expected_stdout"] is None and c["observed_stdout"] is None
        for c in independents(result)
    )
    assert all(c["status"] == "met" for c in independents(result))
    assert all(c["case_code"].startswith("independent-") for c in independents(result))
    # Visible learning cases keep their full detail.
    assert case(result, "visible-30")["expected_stdout"] == "0\n"


async def test_alternative_correct_format_is_accepted_by_integer_comparator():
    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    result = await ss.run_suite(runner_from(correct_behavior(" {} ")), make_code(), suite)
    assert fixed_status(result) == "met"


async def test_endpoint_logic_error_is_rejected_with_a_counterexample():
    # Bug: strict < instead of inclusive <= at 30 and 60.
    def bug(stdin):
        m = int(stdin.strip())
        amount = 0 if m < 30 else 5 if m < 60 else 10
        return "success", f"{amount}\n", "run", False

    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    result = await ss.run_suite(runner_from(bug), make_code(), suite)
    assert result["suspected_hardcoding"] is False
    assert fixed_status(result) == "not_met"
    c30 = case(result, "visible-30")
    assert c30["status"] == "not_met" and c30["expected_stdout"] == "0\n"
    assert "语义不一致" in c30["reason"]


async def test_sample_hardcoding_fails_on_independent_inputs():
    # Memorises only the two shown endpoints; every other input collapses to 0.
    def memorised(stdin):
        m = int(stdin.strip())
        amount = {30: 0, 60: 5}.get(m, 0)
        return "success", f"{amount}\n", "run", False

    result = await ss.run_suite(
        runner_from(memorised), make_code(), ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    )
    assert case(result, "visible-30")["status"] == "met"
    assert case(result, "visible-60")["status"] == "met"
    independent = independents(result)
    assert [c["status"] for c in independent].count("not_met") == 4
    assert all(c["stdin"] is None and c["expected_stdout"] is None for c in independent)
    assert result["suspected_hardcoding"] is True
    assert fixed_status(result) == "not_met"
    fixed_reason = next(c for c in result["criteria"] if c["id"] == "fixed_condition")["reason"]
    assert "硬编码" in fixed_reason
    # The hard-coding reason must never enumerate the hidden failing inputs.
    assert "31" not in fixed_reason and "61" not in fixed_reason


async def test_compile_runtime_and_timeout_are_student_failures_not_infra():
    async def always_compile_error(request):
        return CodeResult(
            status="compile_error", phase="compile", runtime_profile="x",
            request_sha256=request_hash(request),
        )

    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    result = await ss.run_suite(always_compile_error, make_code(), suite)
    assert fixed_status(result) == "not_met"
    assert "编译" in result["cases"][0]["reason"]

    def runtime_on_61(stdin):
        if stdin.strip() == "61":
            return "runtime_error", "", "run", False
        return "success", f"{fee(int(stdin.strip()))}\n", "run", False

    result = await ss.run_suite(runner_from(runtime_on_61), make_code(), suite)
    assert fixed_status(result) == "not_met"
    assert any("运行时" in c["reason"] for c in independents(result))
    assert all(c["stdin"] is None for c in independents(result))

    def timeout_on_31(stdin):
        if stdin.strip() == "31":
            return "timeout", "", "run", False
        return "success", f"{fee(int(stdin.strip()))}\n", "run", False

    result = await ss.run_suite(runner_from(timeout_on_31), make_code(), suite)
    assert fixed_status(result) == "not_met"
    assert any("超时" in c["reason"] for c in independents(result))


async def test_infrastructure_failures_never_lower_ability_state():
    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)

    async def env_error(request):
        return CodeResult(
            status="environment_error", phase="prepare", runtime_profile="x",
            request_sha256=request_hash(request),
        )

    assert fixed_status(await ss.run_suite(env_error, make_code(), suite)) == "needs_review"

    async def blocked_cleanup(request):
        return CodeResult(
            status="success", phase="cleanup", stdout="0\n", runtime_profile="x",
            request_sha256=request_hash(request),
        )

    assert fixed_status(await ss.run_suite(blocked_cleanup, make_code(), suite)) == "needs_review"

    async def truncated(request):
        return CodeResult(
            status="success", phase="run", stdout="0\n", truncated=True, runtime_profile="x",
            request_sha256=request_hash(request),
        )

    assert fixed_status(await ss.run_suite(truncated, make_code(), suite)) == "needs_review"

    async def raises(request):
        raise RuntimeError("worker unreachable")

    assert fixed_status(await ss.run_suite(raises, make_code(), suite)) == "needs_review"

    async def wrong_hash(request):
        return CodeResult(
            status="success", phase="run", stdout="0\n", runtime_profile="x",
            request_sha256="tampered",
        )

    assert fixed_status(await ss.run_suite(wrong_hash, make_code(), suite)) == "needs_review"


async def test_hidden_inputs_never_leak_across_success_failure_and_env_error():
    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    hidden_stdins = {case.stdin for case in suite.independent_cases}
    hidden_tokens = {value.strip() for value in hidden_stdins}

    def correct(stdin):
        return "success", f"{fee(int(stdin.strip()))}\n", "run", False

    def memorised(stdin):
        amount = {30: 0, 60: 5}.get(int(stdin.strip()), 0)
        return "success", f"{amount}\n", "run", False

    def env_error(stdin):
        return "environment_error", "", "prepare", False

    for run in (correct, memorised, env_error):
        result = await ss.run_suite(runner_from(run), make_code(), suite)
        for item in independents(result):
            assert item["stdin"] is None, run
            assert item["expected_stdout"] is None, run
            assert item["observed_stdout"] is None, run
            assert item["case_code"].startswith("independent-"), run
            # Reasons must never reveal the hidden input or answer.
            assert not any(token in item["reason"] for token in hidden_tokens), run
        fixed_reason = next(
            c for c in result["criteria"] if c["id"] == "fixed_condition"
        )["reason"]
        assert not any(token in fixed_reason for token in hidden_tokens), run


async def test_language_mismatch_is_rejected():
    suite = ss.get_suite(COURSE, OBJECTIVE, ACTIVITY)
    with pytest.raises(ApiError) as exc:
        await ss.run_suite(
            runner_from(correct_behavior()),
            CodeRequest(language="python313", entry="main.py", files={"main.py": "print(0)"}),
            suite,
        )
    assert exc.value.status == 400 and exc.value.code == "SEMANTIC_SUITE_LANGUAGE"


# --- live lease path through GuestLeaseStore._run_code -----------------------


class LeaseRunner:
    def __init__(self, behavior):
        self.behavior = behavior
        self.calls = 0
        self.stdins: list[str] = []

    async def run(self, request: CodeRequest) -> CodeResult:
        self.calls += 1
        self.stdins.append(request.stdin)
        status, stdout, phase, truncated = self.behavior(request.stdin)
        return CodeResult(
            status=status,
            phase=phase,
            stdout=stdout,
            truncated=truncated,
            runtime_profile="c17-isolate-dev@0.1.0",
            request_sha256=request_hash(request),
        )


async def _grant(store):
    nonce = await store.nonce("http://localhost:5173")
    created = await store.create(nonce["nonce"], "http://localhost:5173")
    return UUID(created["lease_id"]), created["token"]


def _suite_submission() -> CodeSubmission:
    return CodeSubmission(
        kind="run_code",
        client_artifact_id=uuid4(),
        client_revision_id=uuid4(),
        code=make_code(),
        task=CodeSuiteRef(
            course_version_id=COURSE, activity_version_id=ACTIVITY, objective_code=OBJECTIVE
        ),
    )


async def test_lease_runs_every_case_on_worker_and_returns_suite_assessment(settings):
    runner = LeaseRunner(correct_behavior())
    store = GuestLeaseStore(settings, code_runner=runner)
    lease_id, token = await _grant(store)
    body = _suite_submission()
    job = await store.start(lease_id, token, "http://localhost:5173", uuid4(), body)
    await asyncio.gather(*store.code_tasks.values())
    snapshot = await store.snapshot(lease_id, token, UUID(job["operation_id"]))
    assert snapshot["status"] == "completed", snapshot
    assessment = snapshot["result"]["suite_assessment"]
    assert assessment["standard_version"] == ss.STANDARD
    assert assessment["suspected_hardcoding"] is False
    assert assessment["criteria"][0]["status"] == "met"
    assert assessment["mastery_asserted"] is False
    # Two visible plus six independent inputs really executed on the worker.
    assert runner.calls == 8
    assert set(runner.stdins) == {"30\n", "60\n", "0\n", "29\n", "31\n", "59\n", "61\n", "120\n"}
    # The operation result binds to the submitted artifact request (stdin is a
    # server-injected placeholder), so the client hash check matches the work.
    assert snapshot["result"]["request_sha256"] == request_hash(make_code())
    assert snapshot["result"]["client_revision_id"] == str(body.client_revision_id)
    await store.close()


async def test_lease_flags_sample_hardcoding(settings):
    def memorised(stdin):
        amount = {30: 0, 60: 5}.get(int(stdin.strip()), 0)
        return "success", f"{amount}\n", "run", False

    runner = LeaseRunner(memorised)
    store = GuestLeaseStore(settings, code_runner=runner)
    lease_id, token = await _grant(store)
    job = await store.start(lease_id, token, "http://localhost:5173", uuid4(), _suite_submission())
    await asyncio.gather(*store.code_tasks.values())
    snapshot = await store.snapshot(lease_id, token, UUID(job["operation_id"]))
    assessment = snapshot["result"]["suite_assessment"]
    assert assessment["suspected_hardcoding"] is True
    assert assessment["criteria"][0]["status"] == "not_met"
    await store.close()


async def test_unknown_suite_is_rejected_before_worker_runs(settings):
    runner = LeaseRunner(correct_behavior())
    store = GuestLeaseStore(settings, code_runner=runner)
    lease_id, token = await _grant(store)
    body = CodeSubmission(
        kind="run_code",
        client_artifact_id=uuid4(),
        client_revision_id=uuid4(),
        code=make_code(),
        task=CodeSuiteRef(
            course_version_id=COURSE, activity_version_id=ACTIVITY, objective_code="CS01-M99-O99"
        ),
    )
    with pytest.raises(ApiError) as exc:
        await store.start(lease_id, token, "http://localhost:5173", uuid4(), body)
    assert exc.value.status == 404 and exc.value.code == "SEMANTIC_SUITE_UNAVAILABLE"
    assert runner.calls == 0
    await store.close()
