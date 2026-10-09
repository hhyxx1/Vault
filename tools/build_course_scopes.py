"""Build navigation-only scope versions from the approved planning inventory.

Does not generate teaching text, assessments, relations, or mastery claims.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content/courses"


def stable_id(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"vault:curriculum:{name}"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    catalog = json.loads((CONTENT / "catalog.json").read_text(encoding="utf-8"))
    with (ROOT / "document/course-construction/TARGET_BACKLOG.csv").open(
        encoding="utf-8-sig", newline=""
    ) as file:
        rows = list(csv.DictReader(file))
    entries = []
    for course in catalog["courses"]:
        code = course["code"]
        version = f"{code}-core-scope-0.1.0"
        objectives = []
        modules = defaultdict(list)
        for row in rows:
            if row["course_code"] != code:
                continue
            reference = row["plan_objective_id"]
            objectives.append({
                "id": stable_id(reference), "code": reference,
                "title": row["observable_goal"],
                "criteria": [{"id": "performance", "title": row["observable_goal"],
                              "verification": "activity_pending"}],
            })
            modules[row["module"]].append(reference)
        outline = [{
            "kind": "chapter", "id": f"{code}-{module.split()[0]}", "title": module.split(" ", 1)[1],
            "children": [{"kind": "unit", "id": f"{ref}-unit",
                          "title": next(g["title"] for g in objectives if g["code"] == ref),
                          "objective_refs": [ref]} for ref in references],
        } for module, references in modules.items()]
        package = {
            "schema_version": "2.0.0", "course_id": course["id"],
            "course_version_id": stable_id(version), "course_code": code,
            "version": version, "title": course["title"],
            "status": "structured_validated", "curriculum_review_state": "unavailable",
            "scope_note": "已确认本科核心建设范围。当前只开放结构导航，正文、实践与核验逐项建设；不表示整课已可学习或完成专业审校。",
            "objectives": objectives, "outline": outline, "relations": [], "activities": [],
        }
        relative = f"{code}/{version}/manifest.json"
        write_json(CONTENT / relative, package)
        entries.append({"id": course["id"], "code": code, "title": course["title"],
                        "version_id": package["course_version_id"], "version": version,
                        "package_path": relative, "full_course_available": False})
    write_json(CONTENT / "scope-catalog.json", {"courses": entries})


if __name__ == "__main__":
    main()
