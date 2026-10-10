import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_generated_ledger_tracks_exact_published_goals_without_completion_claim():
    spec = importlib.util.spec_from_file_location(
        "ledger", ROOT / "tools/curriculum/build_coverage_ledger.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    rows = module.build_rows(ROOT)
    assert len(rows) == 366
    assert len({(r["course_version"], r["objective_id"]) for r in rows}) == 366
    assert all(len(r) == 20 and all(v for v in r.values()) for r in rows)
    assert all(
        r["assessment_state"] == "fixed_condition_only;explanation_and_independence_pending"
        for r in rows
    )
    ml = next(r for r in rows if r["objective_id"] == "CS13-M07-O01")
    assert ml["course_version"] == "CS13-core-practice-0.3.0"
    assert "python313ml-isolate-dev@0.1.0" in ml["environment_profiles"]
    assert "library-kmeans" in ml["normal_case_ids"]
