"""Release checks for core CS03 structures added after syllabus gap review."""

import importlib
import importlib.util
import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_current_release_has_distinct_deque_and_separate_chaining_objectives():
    catalog = json.loads((ROOT / "content/courses/scope-catalog.json").read_text(encoding="utf-8"))
    current = next(course for course in catalog["courses"] if course["code"] == "CS03")
    assert current["version"] == "CS03-core-practice-0.6.0"
    package = json.loads((ROOT / "content/courses" / current["package_path"]).read_text(encoding="utf-8"))
    objectives = {objective["code"]: objective for objective in package["objectives"]}
    assert "实现固定容量循环双端队列" in objectives["CS03-M03-O05"]["title"]
    assert "比较开放定址与分离链接" in objectives["CS03-M09-O04"]["title"]
    for goal, oracle in (
        ("CS03-M03-O05", "cs03_deque"),
        ("CS03-M09-O04", "cs03_chaining"),
    ):
        activity = next(row for row in package["activities"] if row["objective_codes"] == [goal])
        assert activity["semantic_suite"]["oracle_id"] == oracle
        assert len(activity["semantic_suite"]["visible_cases"]) >= 2
        assert activity["semantic_suite"]["independent_case_count"] >= 3
        assert activity["reference_answer"]["files"]["main.cpp"]
        assert any(variant["code"] == "from-scratch" for variant in activity["variants"])
        from vault_backend.course_checks import code_tasks, cs03_priority_queue, cs03_core_coverage, semantic_suites

        suite = semantic_suites.get_suite(
            current["version_id"], goal, cs03_core_coverage.activity_id(goal)
        )
        fixed = code_tasks.resolve_task(
            current["version_id"], goal, "base", cs03_core_coverage.activity_id(goal)
        )
        assert suite.oracle_id == oracle
        assert len(suite.independent_cases) == activity["semantic_suite"]["independent_case_count"]
        assert fixed.stdout == cs03_priority_queue.ORACLES[oracle](fixed.stdin)


def test_deque_model_covers_both_ends_capacity_one_wrap_and_empty():
    module = importlib.import_module("vault_backend.course_checks.cs03_deque")
    stdin = (
        "3\npop_front\npush_back 4\npush_front -1\npush_back 4\n"
        "push_front 8\nfront\nback\npop_back\npop_front\npush_front 9\n"
        "pop_front\npop_front\nsize\n"
    )
    assert module.deque_model(stdin) == (
        "empty\nok\nok\nok\nfull\n-1\n4\n4\n-1\nok\n9\n4\n0\n"
    )
    assert module.deque_model("1\npush_front 2\npush_back 3\npop_back\npop_front\n") == (
        "ok\nfull\n2\nempty\n"
    )


def test_separate_chaining_model_covers_collision_duplicate_delete_and_negative_keys():
    module = importlib.import_module("vault_backend.course_checks.cs03_chaining")
    stdin = (
        "3\nI -1\nI 2\nI 5\nI 2\nF 5\nD 2\nF 5\nP\nC\nV\n"
    )
    assert module.chaining_model(stdin) == (
        "inserted\ninserted\ninserted\nexists\nfound\ndeleted\nfound\n-1 5\n"
        "size=2 max_chain=2\nvalid\n"
    )


def test_deque_and_chaining_reference_programs_match_visible_and_independent_oracles(tmp_path):
    release = importlib.import_module("vault_backend.course_checks.cs03_priority_queue")
    for objective, source_name in (
        ("CS03-M03-O05", "deque"),
        ("CS03-M09-O04", "chaining"),
    ):
        oracle_id = release.GOALS[objective][0]
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
