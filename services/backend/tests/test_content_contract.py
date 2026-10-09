import json
import shutil
from uuid import UUID

import pytest

from vault_backend.checker import LOGIC_ASSIGNMENTS, OPERATIONS, verify_trace, verify_truth_table
from vault_backend.content import CourseRepository
from vault_backend.errors import ApiError
from vault_backend.schemas import TruthTableSubmission


def _copy_content_bundle(source_catalog, package_dir):
    package_dir.mkdir()
    for filename in ("catalog.json", "CS03.stack-example.json", "CS05.logic-example.json"):
        source = (
            source_catalog
            if filename == "catalog.json"
            else source_catalog.with_name(filename)
        )
        shutil.copyfile(source, package_dir / filename)
    return package_dir / "catalog.json"


def test_catalog_has_all_thirteen_planned_courses_without_full_course_claim(settings):
    catalog = json.loads(settings.course_catalog_path.read_text(encoding="utf-8"))
    courses = catalog["courses"]
    assert {item["code"] for item in courses} == {f"CS{i:02d}" for i in range(1, 14)}
    assert len(courses) == 13
    assert len({UUID(item["id"]) for item in courses}) == 13
    assert len({UUID(item["version_id"]) for item in courses}) == 13
    assert all(item["full_course_available"] is False for item in courses)
    for item in courses:
        if item["code"] not in {"CS03", "CS05"}:
            assert item["objective_count"] is None
            assert item["content_state"] == "planned"


def test_example_versions_and_criteria_match_implemented_checker(settings, submission):
    catalog = json.loads(settings.course_catalog_path.read_text(encoding="utf-8"))
    example = json.loads(
        (settings.course_catalog_path.parent / "CS03.stack-example.json").read_text(
            encoding="utf-8"
        )
    )
    course = next(item for item in catalog["courses"] if item["code"] == "CS03")
    assert example["course_id"] == course["id"]
    assert example["course_version_id"] == course["version_id"]
    assert len(example["objectives"]) == course["objective_count"] == 32
    assert len({UUID(item["id"]) for item in example["objectives"]}) == 32
    activity = example["activities"][0]
    assert [(item["kind"], item.get("value")) for item in activity["operations"]] == list(
        OPERATIONS
    )
    feedback = verify_trace(submission)
    assert feedback["course_version"] == example["version"]
    assert feedback["activity_version"] == activity["version"]
    assert feedback["standard_version"] == activity["standard_version"]
    assert {item["id"] for item in feedback["criteria"]} == {
        item["id"] for item in example["objectives"][0]["criteria"]
    }
    assert feedback["mastery_asserted"] is False
    assert example["curriculum_review_state"] == "pending"


def test_logic_example_is_versioned_and_truth_table_is_only_partial_evidence(settings):
    catalog = json.loads(settings.course_catalog_path.read_text(encoding="utf-8"))
    example = json.loads(
        (settings.course_catalog_path.parent / "CS05.logic-example.json").read_text(
            encoding="utf-8"
        )
    )
    course = next(item for item in catalog["courses"] if item["code"] == "CS05")
    assert example["course_id"] == course["id"]
    assert example["course_version_id"] == course["version_id"]
    assert len(example["objectives"]) == course["objective_count"] == 2
    assert tuple(tuple(row) for row in example["activities"][0]["assignments"]) == LOGIC_ASSIGNMENTS
    assert example["curriculum_review_state"] == "pending"
    submission = TruthTableSubmission.model_validate(
        {
            "kind": "verify_truth_table",
            "course_code": "CS05",
            "activity_version": example["activities"][0]["version"],
            "standard_version": example["activities"][0]["standard_version"],
            "client_artifact_id": example["activities"][0]["id"],
            "client_revision_id": example["activities"][0]["version_id"],
            "rows": [
                {"implication": True, "contrapositive": True, "biconditional": True},
                {"implication": True, "contrapositive": True, "biconditional": False},
                {"implication": False, "contrapositive": False, "biconditional": False},
                {"implication": True, "contrapositive": True, "biconditional": True},
            ],
            "explanation": "P 真且 Q 假是蕴含的反例。",
        }
    )
    result = verify_truth_table(submission)
    assert result["truth_correct"] is True
    assert [criterion["id"] for criterion in result["criteria"]] == [
        criterion["id"] for criterion in example["objectives"][0]["criteria"]
    ]
    assert result["mastery_asserted"] is False
    assert result["objective_state"] == "evidence_pending_review"


def test_repository_rejects_a_course_package_with_incomplete_outline_references(
    settings, tmp_path
):
    catalog_path = _copy_content_bundle(settings.course_catalog_path, tmp_path / "courses")

    stack_path = catalog_path.with_name("CS03.stack-example.json")
    stack = json.loads(stack_path.read_text(encoding="utf-8"))
    stack["outline"] = [
        {
            "kind": "chapter",
            "id": "stack-basics",
            "title": "栈基础",
            "objective_refs": ["CS03-STACK-01"],
        }
    ]
    stack_path.write_text(json.dumps(stack), encoding="utf-8")

    repository = CourseRepository(catalog_path)

    assert repository.example is None
    with pytest.raises(ApiError, match="COURSE_VERSION_UNAVAILABLE"):
        repository.get_version(UUID(stack["course_id"]), UUID(stack["course_version_id"]))


def test_repository_preserves_a_valid_course_outline(settings, tmp_path):
    catalog_path = _copy_content_bundle(settings.course_catalog_path, tmp_path / "courses")
    stack_path = catalog_path.with_name("CS03.stack-example.json")
    stack = json.loads(stack_path.read_text(encoding="utf-8"))

    repository = CourseRepository(catalog_path)

    assert repository.example is not None
    assert repository.example["outline"] == stack["outline"]


def test_scope_expansion_uses_a_new_version_identity(settings):
    catalog = json.loads(settings.course_catalog_path.read_text(encoding="utf-8"))
    stack = json.loads(
        settings.course_catalog_path.with_name("CS03.stack-example.json").read_text(encoding="utf-8")
    )
    selected = next(item for item in catalog["courses"] if item["code"] == "CS03")
    assert selected["version"] == stack["version"].rsplit("-", 1)[-1]
    assert stack["course_version_id"] != "0648205a-6d3f-4c7c-b889-5b79c60bf0d4"


def test_repository_allows_a_shared_goal_in_different_outline_units(settings, tmp_path):
    catalog_path = _copy_content_bundle(settings.course_catalog_path, tmp_path / "courses")
    stack_path = catalog_path.with_name("CS03.stack-example.json")
    stack = json.loads(stack_path.read_text(encoding="utf-8"))
    stack["outline"][1]["children"][0]["objective_refs"].append("CS03-STACK-01")
    stack_path.write_text(json.dumps(stack), encoding="utf-8")
    repository = CourseRepository(catalog_path)
    assert repository.example is not None
    assert len(repository.example["objectives"]) == 32


def test_repository_rejects_a_strict_prerequisite_cycle(settings, tmp_path):
    catalog_path = _copy_content_bundle(settings.course_catalog_path, tmp_path / "courses")
    stack_path = catalog_path.with_name("CS03.stack-example.json")
    stack = json.loads(stack_path.read_text(encoding="utf-8"))
    stack["relations"].append(
        {"from": "CS03-STACK-02", "to": "CS03-STACK-01", "kind": "mandatory_prerequisite"}
    )
    stack_path.write_text(json.dumps(stack), encoding="utf-8")
    assert CourseRepository(catalog_path).example is None
