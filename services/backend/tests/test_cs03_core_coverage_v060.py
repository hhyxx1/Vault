"""CS03 source-audited core coverage release: regression and real compiler tests."""

import importlib
import itertools
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_release_adds_six_core_targets_with_theory_sources_and_independent_cases():
    catalog = json.loads((ROOT / "content/courses/scope-catalog.json").read_text(encoding="utf-8"))
    current = next(row for row in catalog["courses"] if row["code"] == "CS03")
    assert current["version"] == "CS03-core-practice-0.6.0"
    package = json.loads(
        (ROOT / "content/courses" / current["package_path"]).read_text(encoding="utf-8")
    )
    assert len(package["objectives"]) == 41
    expected = {
        "CS03-M02-O04": "cs03_binary_search",
        "CS03-M04-O04": "cs03_boyer_moore",
        "CS03-M07-O05": "cs03_prim_forest",
        "CS03-M08-O04": "cs03_floyd_warshall",
        "CS03-M09-O05": "cs03_quadratic_probing",
        "CS03-M10-O05": "cs03_bucket_sort",
    }
    for goal, oracle in expected.items():
        activity = next(row for row in package["activities"] if row["objective_codes"] == [goal])
        assert activity["semantic_suite"]["oracle_id"] == oracle
        assert len(activity["semantic_suite"]["visible_cases"]) >= 2
        assert activity["semantic_suite"]["independent_case_count"] >= 3
        assert len(activity["theory"]) >= 4
        assert activity["source_refs"]
        assert any(row["code"] == "from-scratch" for row in activity["variants"])


def test_binary_search_returns_first_duplicate_and_handles_empty_and_missing_values():
    module = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    assert module.binary_search_model("6 5\n1 2 2 2 4 7\n2 0 3 8 1\n") == "1\n-1\n-1\n-1\n0\n"
    assert module.binary_search_model("0 2\n-4 9\n") == "-1\n-1\n"


def test_boyer_moore_finds_overlaps_and_defines_empty_pattern_boundaries():
    module = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    assert module.boyer_moore_model("ABABABA\nABA\n") == "0 2 4\n"
    assert module.boyer_moore_model("abc\n\n") == "0 1 2 3\n"
    assert module.boyer_moore_model("short\nlongpattern\n") == "none\n"


def test_boyer_moore_reference_matches_naive_search_for_all_short_binary_strings(tmp_path):
    source = ROOT / "tools/curriculum/cs03/boyer_moore.cpp"
    harness = tmp_path / "boyer_moore_property.cpp"
    harness_source = (
        "#define main course_program_main\n"
        f'#include "{source.as_posix()}"\n'
        "#undef main\n"
        "#include <string>\n#include <iostream>\n"
        "int main() { std::string text, pattern; "
        "while (std::getline(std::cin, text) && std::getline(std::cin, pattern)) {"
        " auto hits = boyerMoore(text, pattern); "
        " for (std::size_t i = 0; i < hits.size(); ++i) { if (i) std::cout << ','; "
        "std::cout << hits[i]; } std::cout << '\\n'; } }\n"
    )
    harness.write_text(harness_source, encoding="utf-8")
    executable = tmp_path / "boyer_moore_property.exe"
    build = subprocess.run(
        ["g++", "-std=c++17", "-O2", str(harness), "-o", str(executable)],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "TMPDIR": str(tmp_path), "TMP": str(tmp_path), "TEMP": str(tmp_path)},
    )
    assert build.returncode == 0, build.stderr
    texts = [
        "".join(chars) for length in range(6) for chars in itertools.product("ab", repeat=length)
    ]
    patterns = [
        "".join(chars) for length in range(5) for chars in itertools.product("ab", repeat=length)
    ]
    pairs = [(text, pattern) for text in texts for pattern in patterns]
    request = "".join(f"{text}\n{pattern}\n" for text, pattern in pairs)
    result = subprocess.run(
        [str(executable)], input=request, capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr
    actual = result.stdout.splitlines()
    expected = []
    for text, pattern in pairs:
        hits = (
            list(range(len(text) + 1))
            if not pattern
            else [
                i
                for i in range(len(text) - len(pattern) + 1)
                if text[i : i + len(pattern)] == pattern
            ]
        )
        expected.append(",".join(map(str, hits)))
    assert actual == expected


def test_quadratic_probing_tombstone_and_probe_cycle_limit_are_explicit():
    module = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    transcript = "I 0\nI 11\nI 22\nI 33\nI 44\nD 11\nF 22\nI 55\nP\nV\n"
    assert module.quadratic_probing_model(transcript) == (
        "inserted\ninserted\ninserted\ninserted\ninserted\ndeleted\nfound\ninserted\n"
        "0 22 33 44 55\nvalid\n"
    )
    limited_cycle = "I 0\nI 11\nI 22\nI 33\nI 44\nI 55\nI 66\n"
    assert module.quadratic_probing_model(limited_cycle).endswith("inserted\nfull\n")


def test_prim_contract_accepts_any_minimum_forest_not_only_one_tie_break():
    module = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    from vault_backend.course_checks.cs03_graphs import compare_forest

    source = "4 4\n0 1 1\n1 2 1\n0 2 1\n2 3 5\n"
    expected = module.prim_forest_model(source)
    assert compare_forest(expected, '{"edges":[1,2,3],"cost":7,"components":1}')
    assert compare_forest(expected, '{"edges":[0,1,3],"cost":7,"components":1}')
    assert not compare_forest(expected, '{"edges":[0,2,3],"cost":6,"components":1}')


def test_floyd_warshall_all_pairs_handles_negative_edges_unreachable_and_cycles():
    module = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    source = "4 4\n0 1 5\n0 2 10\n1 2 -4\n2 3 2\n"
    assert (
        module.floyd_warshall_model(source) == "0 5 1 3\nINF 0 -4 -2\nINF INF 0 2\nINF INF INF 0\n"
    )
    assert module.floyd_warshall_model("2 2\n0 1 -1\n1 0 -1\n") == "negative-cycle\n"


def test_bucket_sort_preserves_record_order_for_equal_keys_and_empty_input():
    module = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    assert module.bucket_sort_model("6 5\n4 0\n0 1\n4 2\n2 3\n0 4\n4 5\n") == (
        "0 1\n0 4\n2 3\n4 0\n4 2\n4 5\n"
    )
    assert module.bucket_sort_model("0 3\n") == ""


def test_all_six_reference_programs_compile_and_match_visible_and_private_fixtures(tmp_path):
    release = importlib.import_module("vault_backend.course_checks.cs03_core_coverage")
    catalog = json.loads((ROOT / "content/courses/scope-catalog.json").read_text(encoding="utf-8"))
    current = next(row for row in catalog["courses"] if row["code"] == "CS03")
    package = json.loads(
        (ROOT / "content/courses" / current["package_path"]).read_text(encoding="utf-8")
    )
    programs = {
        "CS03-M02-O04": "binary_search",
        "CS03-M04-O04": "boyer_moore",
        "CS03-M07-O05": "prim_forest",
        "CS03-M08-O04": "floyd_warshall",
        "CS03-M09-O05": "quadratic_probing",
        "CS03-M10-O05": "bucket_sort",
    }
    for goal, basename in programs.items():
        oracle, _ = release.GOALS[goal]
        source = ROOT / f"tools/curriculum/cs03/{basename}.cpp"
        executable = tmp_path / f"{basename}.exe"
        build = subprocess.run(
            ["g++", "-std=c++17", "-O2", str(source), "-o", str(executable)],
            capture_output=True,
            text=True,
            check=False,
            env={
                **os.environ,
                "TMPDIR": str(tmp_path),
                "TMP": str(tmp_path),
                "TEMP": str(tmp_path),
            },
        )
        assert build.returncode == 0, build.stderr
        for stdin in sum(release.INPUTS[oracle], ()):
            run = subprocess.run(
                [str(executable)], input=stdin, capture_output=True, text=True, check=False
            )
            assert run.returncode == 0, run.stderr
            if goal == "CS03-M07-O05":
                from vault_backend.course_checks.cs03_graphs import compare_forest, forest_contract

                assert compare_forest(forest_contract(stdin), run.stdout)
            else:
                assert run.stdout == release.ORACLES[oracle](stdin)

        activity = next(row for row in package["activities"] if row["objective_codes"] == [goal])
        starter_source = tmp_path / f"{basename}-starter.cpp"
        starter_source.write_text(activity["code_request"]["files"]["main.cpp"], encoding="utf-8")
        starter_executable = tmp_path / f"{basename}-starter.exe"
        starter_build = subprocess.run(
            ["g++", "-std=c++17", "-O2", str(starter_source), "-o", str(starter_executable)],
            capture_output=True,
            text=True,
            check=False,
            env={
                **os.environ,
                "TMPDIR": str(tmp_path),
                "TMP": str(tmp_path),
                "TEMP": str(tmp_path),
            },
        )
        assert starter_build.returncode == 0, starter_build.stderr
        starter_failed_visible_case = False
        starter_visible_results = []
        for stdin in release.INPUTS[oracle][0]:
            run = subprocess.run(
                [str(starter_executable)], input=stdin, capture_output=True, text=True, check=False
            )
            if goal == "CS03-M07-O05":
                from vault_backend.course_checks.cs03_graphs import compare_forest, forest_contract

                passed = run.returncode == 0 and compare_forest(forest_contract(stdin), run.stdout)
            else:
                passed = run.returncode == 0 and run.stdout == release.ORACLES[oracle](stdin)
            starter_visible_results.append(passed)
            starter_failed_visible_case |= not passed
        assert starter_failed_visible_case, (
            f"the teaching starter for {goal} must expose its intended defect"
        )
        if goal == "CS03-M07-O05":
            assert not starter_visible_results[0], (
                "the Prim defect must be visible in its base case"
            )


def test_new_activities_are_bound_to_current_trusted_checkers():
    from vault_backend.course_checks import code_tasks, cs03_core_coverage, semantic_suites

    for goal, (oracle, _) in cs03_core_coverage.GOALS.items():
        if goal not in {
            "CS03-M02-O04",
            "CS03-M04-O04",
            "CS03-M07-O05",
            "CS03-M08-O04",
            "CS03-M09-O05",
            "CS03-M10-O05",
        }:
            continue
        suite = semantic_suites.get_suite(
            cs03_core_coverage.COURSE_VERSION, goal, cs03_core_coverage.activity_id(goal)
        )
        task = code_tasks.resolve_task(
            cs03_core_coverage.COURSE_VERSION, goal, "base", cs03_core_coverage.activity_id(goal)
        )
        assert suite.oracle_id == oracle
        assert len(suite.independent_cases) >= 3
        assert task.stdout == cs03_core_coverage.ORACLES[oracle](task.stdin)


def test_inherited_huffman_activity_keeps_equivalence_comparator_in_release_060():
    from vault_backend.code_execution import CodeRequest, CodeResult, request_hash
    from vault_backend.course_checks.code_tasks import assess_task, resolve_task
    from vault_backend.course_checks.cs03_core_coverage import COURSE_VERSION, activity_id

    task = resolve_task(COURSE_VERSION, "CS03-M05-O03", "base", activity_id("CS03-M05-O03"))
    request = CodeRequest(
        language="cpp17",
        entry="main.cpp",
        files={"main.cpp": "// equivalent Huffman codebook"},
        stdin=task.stdin,
    )
    result = CodeResult(
        status="success",
        phase="run",
        runtime_profile="cpp17-isolate",
        request_sha256=request_hash(request),
        stdout=json.dumps({"codes": ["00", "01", "10", "11"], "bits": "000110110011"}),
    )

    assessment = assess_task(task, request, result)

    assert assessment["criteria"][0]["status"] == "met"
