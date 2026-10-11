import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest

from vault_backend.course_checks.algebra_submission import AlgebraRegistry, AlgebraSubmission
from vault_backend.errors import ApiError


@pytest.fixture
def registry_work():
    root = Path(__file__).resolve().parents[3]
    spec = importlib.util.spec_from_file_location(
        "registry_builder", root / "tools/curriculum/build_cs05_algebra.py"
    )
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    package = builder.build_package()
    activity = next(a for a in package["activities"] if a["kind"] == "finite_algebra")
    submission = AlgebraSubmission.model_validate(
        {
            "kind": "verify_finite_algebra",
            "course_version_id": package["course_version_id"],
            "activity_version_id": activity["version_id"],
            "objective_code": "CS05-M07-O01",
            **activity["algebra_prompt"],
            "predictions": {"closed": False, "associative": None, "is_group": False},
            "client_artifact_id": str(uuid4()),
            "client_revision_id": str(uuid4()),
        }
    )
    return AlgebraRegistry([package]), submission, package, activity


def test_registry_binds_result_to_trusted_published_context(registry_work):
    registry, work, package, activity = registry_work
    result = registry.verify(work)
    assert result["course_version_id"] == package["course_version_id"]
    assert result["activity_version_id"] == activity["version_id"]
    assert result["objective_ids"] == [
        next(o["id"] for o in package["objectives"] if o["code"] == work.objective_code)
    ]
    assert result["prediction_correct"] and result["mastery_asserted"] is False


@pytest.mark.parametrize(
    "changes",
    [
        {"objective_code": "CS05-M01-O01"},
        {"course_version_id": uuid4()},
        {"activity_version_id": uuid4()},
        {"table": [[0]]},
    ],
)
def test_registry_rejects_rebound_goal_unknown_version_and_resized_domain(registry_work, changes):
    registry, work, _, _ = registry_work
    with pytest.raises(ApiError):
        registry.verify(work.model_copy(update=changes))


def test_unregistered_package_exposes_no_checker(registry_work):
    _, work, _, _ = registry_work
    with pytest.raises(ApiError):
        AlgebraRegistry([]).verify(work)
