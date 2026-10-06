import json

import pytest

from vault_backend.course_blueprints import audit_scope_blueprints


def test_all_thirteen_have_observable_draft_units_and_no_acceptance_claim(settings):
    report = audit_scope_blueprints(settings.course_catalog_path)
    assert [item["code"] for item in report["courses"]] == [
        f"CS{number:02d}" for number in range(1, 14)
    ]
    assert all(item["draft_unit_count"] >= 4 for item in report["courses"])
    assert all(not item["full_course_available"] for item in report["courses"])
    assert all("course_acceptance" in item["missing_gates"] for item in report["courses"])


def test_missing_course_and_false_availability_are_rejected(settings, tmp_path):
    catalog = json.loads(settings.course_catalog_path.read_text(encoding="utf-8"))
    inventory = json.loads(
        (settings.course_catalog_path.parent / "scope-blueprints.json").read_text(encoding="utf-8")
    )
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog), encoding="utf-8")
    inventory["courses"].pop()
    (tmp_path / "scope-blueprints.json").write_text(json.dumps(inventory), encoding="utf-8")
    with pytest.raises(ValueError, match="exactly once"):
        audit_scope_blueprints(path)

    inventory["courses"] = json.loads(
        (settings.course_catalog_path.parent / "scope-blueprints.json").read_text(encoding="utf-8")
    )["courses"]
    (tmp_path / "scope-blueprints.json").write_text(json.dumps(inventory), encoding="utf-8")
    catalog["courses"][0]["full_course_available"] = True
    path.write_text(json.dumps(catalog), encoding="utf-8")
    with pytest.raises(ValueError, match="must not advertise"):
        audit_scope_blueprints(path)
