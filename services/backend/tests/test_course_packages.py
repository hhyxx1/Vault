import json
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from vault_backend.content import CourseRepository
from vault_backend.errors import ApiError


def write_package(root: Path, *, code="CUSTOM-ARCH", status="structured_validated"):
    root.mkdir(exist_ok=True)
    course_id, version_id, goal_id = (str(uuid4()) for _ in range(3))
    goal = f"{code}-01"
    package = {
        "schema_version": "2.0.0",
        "course_id": course_id,
        "course_version_id": version_id,
        "course_code": code,
        "version": f"{code}@1.0.0",
        "title": "架构练习",
        "status": status,
        "scope_note": "独立的小范围课程，不声明整课完整。",
        "curriculum_review_state": "unavailable",
        "objectives": [
            {
                "id": goal_id,
                "code": goal,
                "title": "给出一个设计取舍",
                "criteria": [
                    {
                        "id": "tradeoff",
                        "title": "说明约束和取舍",
                        "verification": "independent_review_pending",
                    }
                ],
            }
        ],
        "outline": [
            {
                "kind": "chapter",
                "id": "c1",
                "title": "约束",
                "children": [
                    {"kind": "unit", "id": "u1", "title": "取舍", "objective_refs": [goal]}
                ],
            }
        ],
        "relations": [],
        "activities": [],
    }
    (root / "package.json").write_text(json.dumps(package), encoding="utf-8")
    catalog = {
        "courses": [
            {
                "id": course_id,
                "version_id": version_id,
                "code": code,
                "title": package["title"],
                "package_path": "package.json",
                "full_course_available": False,
            }
        ]
    }
    (root / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
    return package, catalog


def test_new_course_loads_without_examples_or_thirteen_course_whitelist(tmp_path):
    package, catalog = write_package(tmp_path)
    repository = CourseRepository(tmp_path / "catalog.json")
    assert repository.get_catalog() == catalog
    assert (
        repository.get_version(UUID(package["course_id"]), UUID(package["course_version_id"]))
        == package
    )


def test_scope_upgrade_preserves_explicitly_archived_course_version(tmp_path):
    package, catalog = write_package(tmp_path)
    (tmp_path / "catalog.json").write_text(
        json.dumps({"courses": [{**catalog["courses"][0], "package_path": "new.json"}]}),
        encoding="utf-8",
    )
    current = {**package, "course_version_id": str(uuid4()), "version": "CUSTOM-ARCH@2"}
    (tmp_path / "new.json").write_text(json.dumps(current), encoding="utf-8")
    entry = {
        **catalog["courses"][0],
        "version_id": current["course_version_id"],
        "package_path": "new.json",
    }
    (tmp_path / "catalog.json").write_text(json.dumps({"courses": [entry]}), encoding="utf-8")
    (tmp_path / "scope-catalog.json").write_text(
        json.dumps({"courses": [entry], "archived_courses": catalog["courses"]}), encoding="utf-8"
    )
    repository = CourseRepository(tmp_path / "catalog.json")
    assert (
        repository.get_version(UUID(package["course_id"]), UUID(package["course_version_id"]))
        == package
    )
    assert (
        repository.get_scope_catalog()["courses"][0]["version_id"] == current["course_version_id"]
    )
    assert len(repository.get_scope_catalog()["courses"]) == 1


def test_bad_package_does_not_hide_catalog_or_other_course(tmp_path):
    package, catalog = write_package(tmp_path)
    catalog["courses"].append(
        {
            "id": str(uuid4()),
            "version_id": str(uuid4()),
            "code": "BROKEN",
            "package_path": "missing.json",
        }
    )
    (tmp_path / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
    repository = CourseRepository(tmp_path / "catalog.json")
    assert len(repository.get_catalog()["courses"]) == 2
    assert repository.get_version(UUID(package["course_id"]), UUID(package["course_version_id"]))
    with pytest.raises(ApiError, match="COURSE_VERSION_UNAVAILABLE"):
        repository.get_version(
            UUID(catalog["courses"][1]["id"]), UUID(catalog["courses"][1]["version_id"])
        )


@pytest.mark.parametrize(
    "fault", ["path_escape", "wrong_identity", "dangling_activity", "draft", "hidden_answer"]
)
def test_invalid_or_private_package_never_served(tmp_path, fault):
    root = tmp_path / "courses"
    package, catalog = write_package(root)
    if fault == "path_escape":
        (tmp_path / "outside.json").write_text(json.dumps(package), encoding="utf-8")
        catalog["courses"][0]["package_path"] = "../outside.json"
    elif fault == "wrong_identity":
        package["course_id"] = str(uuid4())
    elif fault == "dangling_activity":
        package["activities"] = [
            {"id": str(uuid4()), "version_id": str(uuid4()), "objective_codes": ["MISSING"]}
        ]
    elif fault == "draft":
        package["status"] = "draft"
    elif fault == "hidden_answer":
        package["hidden_tests"] = [{"input": "secret"}]
    (root / "package.json").write_text(json.dumps(package), encoding="utf-8")
    (root / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
    repository = CourseRepository(root / "catalog.json")
    with pytest.raises(ApiError, match="COURSE_VERSION_UNAVAILABLE"):
        repository.get_version(
            UUID(catalog["courses"][0]["id"]), UUID(catalog["courses"][0]["version_id"])
        )


def test_all_thirteen_full_scopes_match_approved_target_inventory(settings):
    import csv

    root = settings.course_catalog_path.parent
    index_path = root / "scope-catalog.json"
    assert index_path.exists(), "Full scope packages must be versioned independently of examples"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    assert {c["code"] for c in index["courses"]} == {f"CS{i:02d}" for i in range(1, 14)}
    inventory_path = root.parent.parent / "document/course-construction/TARGET_BACKLOG.csv"
    with inventory_path.open(encoding="utf-8-sig") as file:
        approved = {row["plan_objective_id"] for row in csv.DictReader(file)}
    repo = CourseRepository(settings.course_catalog_path)
    actual = set()
    for entry in index["courses"]:
        course = repo.get_version(UUID(entry["id"]), UUID(entry["version_id"]))
        assert course["status"] == "structured_validated"
        assert course["curriculum_review_state"] == "unavailable"
        actual.update(goal["code"] for goal in course["objectives"])
    assert actual == approved
