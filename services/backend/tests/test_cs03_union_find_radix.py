"""Regression tests for the next CS03 coverage release."""

import importlib
import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_current_release_has_independent_union_find_and_radix_objectives():
    catalog = json.loads((ROOT / "content/courses/scope-catalog.json").read_text(encoding="utf-8"))
    current = next(row for row in catalog["courses"] if row["code"] == "CS03")
    assert current["version"] == "CS03-core-practice-0.6.0"
    package = json.loads((ROOT / "content/courses" / current["package_path"]).read_text(encoding="utf-8"))
    objectives = {row["code"]: row for row in package["objectives"]}
    assert "并查集" in objectives["CS03-M07-O04"]["title"]
    assert "基数排序" in objectives["CS03-M10-O04"]["title"]
    for goal, oracle in (
        ("CS03-M07-O04", "cs03_union_find"),
        ("CS03-M10-O04", "cs03_radix_sort"),
    ):
        activity = next(row for row in package["activities"] if row["objective_codes"] == [goal])
        assert activity["semantic_suite"]["oracle_id"] == oracle
        assert len(activity["semantic_suite"]["visible_cases"]) >= 2
        assert activity["semantic_suite"]["independent_case_count"] >= 3
        assert activity["theory"]
        assert activity["source_refs"]
        assert any(row["code"] == "from-scratch" for row in activity["variants"])


def test_union_find_oracle_checks_merge_connectivity_sizes_and_path_compression():
    module = importlib.import_module("vault_backend.course_checks.cs03_union_find")
    stdin = (
        "8\nU 0 1\nU 2 3\nU 0 2\nU 4 5\nU 6 7\nU 4 6\nU 0 4\n"
        "N\nP 7\nP 7\nC 3 7\nS 7\nV\n"
    )
    assert module.union_find_model(stdin) == "merged\nmerged\nmerged\nmerged\nmerged\nmerged\nmerged\n1\n3\n1\n1\n8\nvalid\n"


def test_radix_oracle_checks_unsigned_32_bit_order_and_stability():
    module = importlib.import_module("vault_backend.course_checks.cs03_radix_sort")
    stdin = "7\n256 0\n0 1\n1 2\n256 3\n255 4\n65536 5\n0 6\n"
    expected = {"records": [[0, 1], [0, 6], [1, 2], [255, 4], [256, 0], [256, 3], [65536, 5]]}
    assert json.loads(module.radix_sort_model(stdin)) == expected


def test_both_new_reference_programs_match_visible_and_private_cases(tmp_path):
    release = importlib.import_module("vault_backend.course_checks.cs03_union_find_radix")
    for goal, source_name in (
        ("CS03-M07-O04", "union_find"),
        ("CS03-M10-O04", "radix_sort"),
    ):
        oracle_id = release.GOALS[goal][0]
        source = ROOT / f"tools/curriculum/cs03/{source_name}.cpp"
        assert source.is_file()
        executable = tmp_path / f"{source_name}.exe"
        build = subprocess.run(
            ["g++", "-std=c++17", "-O2", str(source), "-o", str(executable)],
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "TMPDIR": str(tmp_path), "TMP": str(tmp_path), "TEMP": str(tmp_path)},
        )
        assert build.returncode == 0, build.stderr
        for stdin in sum(release.INPUTS[oracle_id], ()):
            run = subprocess.run(
                [str(executable)], input=stdin, capture_output=True, text=True, check=False
            )
            assert run.returncode == 0, run.stderr
            assert run.stdout == release.ORACLES[oracle_id](stdin)


def test_new_version_registers_fixed_tasks_and_private_semantic_suites():
    from vault_backend.course_checks import code_tasks, cs03_union_find_radix, semantic_suites

    for goal, (oracle, _) in cs03_union_find_radix.GOALS.items():
        if goal not in {"CS03-M07-O04", "CS03-M10-O04"}:
            continue
        suite = semantic_suites.get_suite(
            cs03_union_find_radix.COURSE_VERSION,
            goal,
            cs03_union_find_radix.activity_id(goal),
        )
        task = code_tasks.resolve_task(
            cs03_union_find_radix.COURSE_VERSION,
            goal,
            "base",
            cs03_union_find_radix.activity_id(goal),
        )
        assert suite.oracle_id == oracle
        assert len(suite.independent_cases) >= 3
        assert task.stdout == cs03_union_find_radix.ORACLES[oracle](task.stdin)
