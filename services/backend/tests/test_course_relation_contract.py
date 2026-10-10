import json
from pathlib import Path

import pytest

from vault_backend.course_packages import PublicCoursePackage

PATH = (
    Path(__file__).resolve().parents[3]
    / "content/courses/CS01/CS01-core-practice-0.8.0/manifest.json"
)


def edge(first="CS01-M02-O01", second="CS01-M03-O01"):
    return {
        "from": first,
        "to": second,
        "kind": "mandatory_prerequisite",
        "source": "authoring review",
    }


@pytest.mark.parametrize(
    "relations",
    [
        [edge(second="not-a-goal")],
        [edge(), edge()],
        [edge(), edge("CS01-M03-O01", "CS01-M02-O01")],
        [edge("CS01-M02-O01", "CS01-M02-O01")],
    ],
)
def test_invalid_graph_relations_are_rejected_before_publication(relations):
    package = json.loads(PATH.read_text(encoding="utf-8"))
    package["relations"] = relations
    with pytest.raises(ValueError):
        PublicCoursePackage.model_validate(package)


def test_checked_relation_retains_reason_source_version_and_review_boundary():
    package = json.loads(PATH.read_text(encoding="utf-8"))
    package["relations"] = [
        {
            **edge(),
            "reason": "Conditional expressions require expression evaluation.",
            "source_locator": "wg14-n1570-control:6.8.4.1",
            "course_version_id": package["course_version_id"],
            "review_state": "authority_checked",
        }
    ]
    loaded = PublicCoursePackage.model_validate(package)
    assert loaded.relations[0].reason
    assert loaded.curriculum_review_state == "unavailable"


def test_application_cycles_are_not_misclassified_as_prerequisite_cycles():
    package = json.loads(PATH.read_text(encoding="utf-8"))
    package["relations"] = [
        {**edge(), "kind": "application"},
        {**edge("CS01-M03-O01", "CS01-M02-O01"), "kind": "application"},
    ]
    assert len(PublicCoursePackage.model_validate(package).relations) == 2


@pytest.mark.parametrize(
    "field,value",
    [
        ("course_version_id", "wrong-version"),
        ("reason", ""),
        ("source_locator", "not-a-source:6.8"),
    ],
)
def test_checked_relationship_metadata_cannot_silently_drift(field, value):
    package = json.loads(PATH.read_text(encoding="utf-8"))
    package["relations"][0][field] = value
    with pytest.raises(ValueError):
        PublicCoursePackage.model_validate(package)
