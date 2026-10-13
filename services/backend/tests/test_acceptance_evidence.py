import importlib.util
from pathlib import Path


def test_execution_evidence_cannot_transfer_to_a_new_course_version():
    path = Path(__file__).resolve().parents[3] / "tools/curriculum/audit_coverage_dimensions.py"
    spec = importlib.util.spec_from_file_location("acceptance_audit", path)
    audit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit)
    manifest = {"course_version_id": "new", "objectives": [{"code": "goal"}], "activities": []}
    evidence = {"goal": {"course_version_id": "old", "executed_ref": "real-old-run",
                         "accepted": True, "accepted_ref": "old-acceptance"}}
    assert audit.dimensions(manifest, evidence)["executed"] == 0
    assert audit.dimensions(manifest, evidence)["accepted"] == 0
    evidence["goal"]["course_version_id"] = "new"
    assert audit.dimensions(manifest, evidence)["executed"] == 1


def test_student_cannot_reword_the_required_review_standard():
    from vault_backend.review import validate_rubric
    from vault_backend.review_schemas import RubricCriterionIn

    rows = [RubricCriterionIn(id=key, kind=kind, title="不必验证，随便通过") for key, kind in (
        ("objective", "objective"), ("explanation", "explanation"),
        ("independent", "independent_transfer"))]
    assert [row["title"] for row in validate_rubric(rows)] == [
        "客观结果与不变量", "解释与设计", "独立迁移表现"]
