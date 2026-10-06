"""Check the draft curriculum inventory without treating it as published content."""

import json
from pathlib import Path


def audit_scope_blueprints(catalog_path: Path) -> dict:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    inventory_path = catalog_path.with_name("scope-blueprints.json")
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    expected = {course["code"]: course for course in catalog["courses"]}
    if len(expected) != len(catalog["courses"]) or expected.keys() != {
        f"CS{number:02d}" for number in range(1, 14)
    }:
        raise ValueError("Default catalog must contain CS01–CS13 once each")
    if inventory["status"] != "draft_scope_inventory":
        raise ValueError("Scope inventory must remain marked as a draft")
    courses = inventory["courses"]
    codes = [course["code"] for course in courses]
    if len(codes) != len(set(codes)) or set(codes) != expected.keys():
        raise ValueError("Scope inventory must cover each default course exactly once")

    report = []
    for course in courses:
        code = course["code"]
        units = course["units"]
        if len(units) < 4 or len({unit[0] for unit in units}) != len(units):
            raise ValueError(f"{code} requires at least four distinct draft units")
        if any(
            len(unit) != 3 or any(not isinstance(item, str) or not item.strip() for item in unit)
            for unit in units
        ):
            raise ValueError(f"{code} units require title, observable goal and practice artifact")
        if expected[code]["full_course_available"] or expected[code]["content_state"] not in {
            "planned",
            "engineering_example",
        }:
            raise ValueError(f"{code} draft must not advertise full-course availability")
        report.append(
            {
                "code": code,
                "title": expected[code]["title"],
                "draft_unit_count": len(units),
                "full_course_available": False,
                "missing_gates": [
                    "complete_scope_review",
                    "theory_and_sources",
                    "activities_and_feedback",
                    "verification",
                    "curriculum_review",
                    "course_acceptance",
                ],
            }
        )
    return {"status": "draft_scope_inventory", "courses": report}


if __name__ == "__main__":
    from vault_backend.config import Settings

    report = audit_scope_blueprints(Settings().course_catalog_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))
