"""C01: trusted checks resolve from a server-private package sidecar, so a new
course that is not CS01-CS13 gets fixed-condition and semantic verification
without editing backend Python whitelists.  The sidecar carries data only and
is never exposed through public endpoints.
"""

import json
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
from vault_backend.content import CourseRepository
from vault_backend.course_checks.code_tasks import assess_task
from vault_backend.course_checks.semantic_suites import ORACLES
from vault_backend.course_checks.server_checks import (
    DynamicCheckRegistry,
    load_server_expectations,
)
from vault_backend.errors import ApiError

CODE = "BOOTCAMP"
OBJECTIVE = "BOOTCAMP-M01-O1"


def _source(main: str) -> dict:
    return {"language": "c17", "entry": "main.c", "files": {"main.c": main}, "stdin": ""}


def write_synthetic_course(root: Path, *, sidecar=None, broken_sidecar=False):
    """A minimal, non-CS course with one code activity announcing a suite."""
    root.mkdir(exist_ok=True)
    course_id, version_id, goal_id, activity_id, activity_version = (
        str(uuid4()) for _ in range(5)
    )
    main = (
        "#include <stdio.h>\nint main(void){int m;scanf(\"%d\",&m);"
        "printf(\"%d\\n\",m<=30?0:m<=60?5:10);return 0;}\n"
    )
    package = {
        "schema_version": "2.0.0",
        "course_id": course_id,
        "course_version_id": version_id,
        "course_code": CODE,
        "version": f"{CODE}@1.0.0",
        "title": "合成工具演练课",
        "status": "structured_validated",
        "scope_note": "用于验证工具复用的数据驱动合成课，不属十三门默认课。",
        "curriculum_review_state": "unavailable",
        "objectives": [
            {
                "id": goal_id,
                "code": OBJECTIVE,
                "title": "按三段规则计算费用",
                "criteria": [
                    {
                        "id": "fixed_condition",
                        "title": "固定条件",
                        "verification": "deterministic_checker",
                    },
                    {
                        "id": "independent_transfer",
                        "title": "独立迁移",
                        "verification": "deterministic_checker",
                    },
                ],
            }
        ],
        "outline": [
            {
                "kind": "chapter",
                "id": "c1",
                "title": "输入与分支",
                "children": [
                    {"kind": "unit", "id": "u1", "title": "分段计费", "objective_refs": [OBJECTIVE]}
                ],
            }
        ],
        "relations": [],
        "sources": [
            {
                "id": "wg14-n1570",
                "title": "ISO C 选择与迭代语句",
                "url": "https://www.iso.org/standard/74528.html",
                "locator": "6.8 Selection and iteration statements",
                "checked_at": "2026-10-11",
                "status": "authority_checked",
            }
        ],
        "activities": [
            {
                "id": activity_id,
                "version_id": activity_version,
                "code": f"{OBJECTIVE}-CODE",
                "version": f"{OBJECTIVE}-CODE@0.1.0",
                "objective_codes": [OBJECTIVE],
                "kind": "code",
                "title": "多输入分段计费",
                "student_action": "从标准输入读取分钟数，输出对应费用。",
                "theory": ["端点与其两侧用于暴露区间条件缺口。"],
                "starter": "先写预测，再实现并运行。",
                "source_refs": ["wg14-n1570"],
                "availability": "practice_ready",
                "completion_limit": "只核验指定输入；硬编码不证明一般正确。",
                "check_version": "code-fixed-condition-v1",
                "code_request": _source(main),
                "reference_answer": _source(main),
                "semantic_suite": {
                    "standard_version": "code-semantic-suite-v1",
                    "oracle_id": "parking_fee_three_tier",
                    "comparator": "integer",
                    "language": "c17",
                    "visible_cases": [
                        {"code": "visible-30", "stdin": "30\n"},
                        {"code": "visible-60", "stdin": "60\n"},
                    ],
                    "independent_case_count": 2,
                    "scope_note": "合成课复用平台停车费 oracle 的独立核验；独立输入仅在服务端。",
                },
            }
        ],
    }
    version_dir = root / "synth-1.0.0"
    version_dir.mkdir(exist_ok=True)
    (version_dir / "manifest.json").write_text(json.dumps(package), encoding="utf-8")

    if broken_sidecar:
        (version_dir / "server-expectations.json").write_text("{ not valid json", encoding="utf-8")
    elif sidecar is not None:
        (version_dir / "server-expectations.json").write_text(
            json.dumps(sidecar), encoding="utf-8"
        )

    catalog = {
        "courses": [
            {
                "id": course_id,
                "version_id": version_id,
                "code": CODE,
                "title": package["title"],
                "package_path": "synth-1.0.0/manifest.json",
                "full_course_available": False,
            }
        ]
    }
    (root / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
    return package, catalog


def valid_sidecar(package: dict) -> dict:
    activity_version = package["activities"][0]["version_id"]
    return {
        "course_id": package["course_id"],
        "course_version_id": package["course_version_id"],
        "course_code": CODE,
        "fixed_conditions": [
            {
                "activity_version_id": activity_version,
                "objective_code": OBJECTIVE,
                "task_code": "base",
                "stdin": "60\n",
                "status": "success",
                "stdout": "5\n",
                "stderr": "",
            }
        ],
        "semantic_suites": [
            {
                "activity_version_id": activity_version,
                "objective_code": OBJECTIVE,
                "independent_cases": [
                    {"code": "indep-31", "stdin": "31\n"},
                    {"code": "indep-61", "stdin": "61\n"},
                ],
            }
        ],
    }


@pytest.fixture
def loaded(tmp_path):
    package, _catalog = write_synthetic_course(tmp_path)
    sidecar = valid_sidecar(package)
    (tmp_path / "synth-1.0.0" / "server-expectations.json").write_text(
        json.dumps(sidecar), encoding="utf-8"
    )
    repository = CourseRepository(tmp_path / "catalog.json")
    return package, repository


def test_synthetic_course_loads_sidecar_without_backend_whitelist(loaded):
    package, repository = loaded
    assert (package["course_id"], package["course_version_id"]) in repository.packages
    assert len(repository.server_expectations) == 1
    registry = DynamicCheckRegistry(repository.server_expectations)

    task = registry.resolve_task(
        package["course_version_id"], OBJECTIVE, "base",
        package["activities"][0]["version_id"],
    )
    assert task is not None
    assert task.stdin == "60\n"
    assert task.stdout == "5\n"
    assert task.standard_version == "code-fixed-condition-v1"

    suite = registry.get_suite(
        package["course_version_id"], OBJECTIVE,
        package["activities"][0]["version_id"],
    )
    assert suite is not None
    assert suite.oracle_id == "parking_fee_three_tier"
    assert [c.code for c in suite.visible_cases] == ["visible-30", "visible-60"]
    assert [c.code for c in suite.independent_cases] == ["indep-31", "indep-61"]


def test_dynamic_fixed_condition_is_assessed_by_generic_checker(loaded):
    package, repository = loaded
    registry = DynamicCheckRegistry(repository.server_expectations)
    task = registry.resolve_task(package["course_version_id"], OBJECTIVE, "base")

    request = CodeRequest(
        language="c17", entry="main.c",
        files={"main.c": "int main(){}"}, stdin=task.stdin,
    )
    good = CodeResult(
        status="success", phase="run", stdout=task.stdout, stderr="",
        truncated=False, runtime_profile="c17-isolate-dev@0.1.0",
        request_sha256=request_hash(request),
    )
    assessment = assess_task(task, request, good)
    assert assessment["criteria"][0]["status"] == "met"

    bad = good.model_copy(update={"stdout": "9\n"})
    assert assess_task(task, request, bad)["criteria"][0]["status"] == "not_met"


def test_dynamic_suite_oracle_agrees_with_independent_inputs(loaded):
    package, repository = loaded
    registry = DynamicCheckRegistry(repository.server_expectations)
    suite = registry.get_suite(package["course_version_id"], OBJECTIVE)
    oracle = ORACLES[suite.oracle_id]
    # 31 -> tier 2 (5), 61 -> tier 3 (10); data-driven inputs, trusted oracle.
    assert {c.stdin.strip(): oracle(c.stdin).strip() for c in suite.independent_cases} == {
        "31": "5",
        "61": "10",
    }


def test_registry_returns_none_on_unknown_or_version_mismatch(loaded):
    package, repository = loaded
    registry = DynamicCheckRegistry(repository.server_expectations)
    assert registry.resolve_task(package["course_version_id"], OBJECTIVE, "nope") is None
    assert registry.resolve_task(str(uuid4()), OBJECTIVE, "base") is None
    assert (
        registry.resolve_task(
            package["course_version_id"], OBJECTIVE, "base", str(uuid4())
        )
        is None
    )
    assert registry.get_suite(str(uuid4()), OBJECTIVE) is None


def test_sidecar_independent_inputs_never_served_publicly(loaded):
    package, repository = loaded
    served = repository.get_version(
        UUID(package["course_id"]), UUID(package["course_version_id"])
    )
    encoded = json.dumps(served, ensure_ascii=False)
    # Independent stdin and the sidecar filename must never reach a client.
    assert "indep-31" not in encoded
    assert "31\n" not in json.dumps(
        served["activities"][0]["semantic_suite"], ensure_ascii=False
    )
    scope = json.dumps(repository.get_scope_catalog(), ensure_ascii=False)
    assert "server-expectations" not in scope


def test_missing_sidecar_yields_no_dynamic_checks_but_package_loads(tmp_path):
    package, _ = write_synthetic_course(tmp_path)
    repository = CourseRepository(tmp_path / "catalog.json")
    assert (package["course_id"], package["course_version_id"]) in repository.packages
    assert repository.server_expectations == []


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p, s: s.update(course_code="CS99"),
        lambda p, s: s["semantic_suites"][0]["independent_cases"].pop(),
        lambda p, s: s["semantic_suites"][0]["independent_cases"].append(
            {"code": "visible-30", "stdin": "1\n"}
        ),
        lambda p, s: s["fixed_conditions"][0].update(
            activity_version_id=str(uuid4())
        ),
        lambda p, s: s.update(checker_py="print('pwned')"),
        lambda p, s: s["fixed_conditions"][0].update(status="environment_error"),
    ],
)
def test_invalid_sidecar_is_rejected(tmp_path, mutate):
    package, _ = write_synthetic_course(tmp_path)
    sidecar = valid_sidecar(package)
    mutate(package, sidecar)
    version_dir = tmp_path / "synth-1.0.0"
    (version_dir / "server-expectations.json").write_text(
        json.dumps(sidecar, default=str), encoding="utf-8"
    )
    with pytest.raises((ValueError, ValidationError)):
        load_server_expectations(version_dir, package)


def test_untrusted_oracle_in_manifest_rejected(tmp_path):
    package, _ = write_synthetic_course(tmp_path)
    package["activities"][0]["semantic_suite"]["oracle_id"] = "os.system"
    sidecar = valid_sidecar(package)
    (tmp_path / "synth-1.0.0" / "server-expectations.json").write_text(
        json.dumps(sidecar), encoding="utf-8"
    )
    with pytest.raises((ValueError, ValidationError)):
        load_server_expectations(tmp_path / "synth-1.0.0", package)


def test_broken_sidecar_fails_package_closed_but_keeps_others(tmp_path):
    # First course with a malformed sidecar is dropped.
    write_synthetic_course(tmp_path, broken_sidecar=True)
    repository = CourseRepository(tmp_path / "catalog.json")
    assert repository.packages == {}
    assert repository.server_expectations == []


def test_guest_store_prefers_dynamic_registry(loaded):
    from vault_backend.guests import GuestLeaseStore

    package, repository = loaded
    registry = DynamicCheckRegistry(repository.server_expectations)
    store = GuestLeaseStore(
        settings=object(), check_registry=registry  # type: ignore[arg-type]
    )
    task = store._resolve_task(
        package["course_version_id"], OBJECTIVE, "base",
        package["activities"][0]["version_id"],
    )
    assert task.stdout == "5\n"
    suite = store._resolve_suite(
        package["course_version_id"], OBJECTIVE,
        package["activities"][0]["version_id"],
    )
    assert suite.oracle_id == "parking_fee_three_tier"
    # Unknown dynamic keys fall through to the frozen registry, which 404s.
    with pytest.raises(ApiError) as exc:
        store._resolve_task(str(uuid4()), OBJECTIVE, "base", str(uuid4()))
    assert exc.value.code == "CODE_TASK_UNAVAILABLE"
