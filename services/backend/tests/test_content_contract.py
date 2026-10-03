import json
from uuid import UUID

from vault_backend.checker import OPERATIONS, verify_trace


def test_catalog_has_all_thirteen_planned_courses_without_full_course_claim(settings):
    catalog = json.loads(settings.course_catalog_path.read_text(encoding="utf-8"))
    courses = catalog["courses"]
    assert {item["code"] for item in courses} == {f"CS{i:02d}" for i in range(1, 14)}
    assert len(courses) == 13
    assert len({UUID(item["id"]) for item in courses}) == 13
    assert len({UUID(item["version_id"]) for item in courses}) == 13
    assert all(item["full_course_available"] is False for item in courses)
    for item in courses:
        if item["code"] != "CS03":
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
    assert len(example["objectives"]) == course["objective_count"] == 2
    assert len({UUID(item["id"]) for item in example["objectives"]}) == 2
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
