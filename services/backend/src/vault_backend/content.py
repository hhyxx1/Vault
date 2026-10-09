import json
from pathlib import Path
from uuid import UUID

from vault_backend.checker import LOGIC_ASSIGNMENTS, OPERATIONS
from vault_backend.errors import ApiError


def _validate_course_outline(course: dict) -> None:
    objectives = course.get("objectives")
    if not isinstance(objectives, list):
        raise ValueError("Course objectives must be a list")

    reference_to_objective: dict[str, str] = {}
    objective_ids: set[str] = set()
    for objective in objectives:
        if not isinstance(objective, dict):
            raise ValueError("Course objectives must be objects")
        objective_id = objective.get("id") or objective.get("code")
        objective_code = objective.get("code") or objective_id
        required_values = (objective_id, objective_code, objective.get("title"))
        if any(not isinstance(value, str) or not value.strip() for value in required_values):
            raise ValueError("Course objectives require stable IDs, codes, and titles")
        if objective_id in objective_ids:
            raise ValueError(f"Duplicate course objective ID: {objective_id}")
        objective_ids.add(objective_id)
        for reference in {objective_id, objective_code}:
            existing = reference_to_objective.get(reference)
            if existing is not None and existing != objective_id:
                raise ValueError(f"Duplicate course objective reference: {reference}")
            reference_to_objective[reference] = objective_id

    prerequisite_children: dict[str, list[str]] = {}
    for relation in course.get("relations", []):
        source = reference_to_objective.get(relation.get("from"))
        target = reference_to_objective.get(relation.get("to"))
        if source is None or target is None:
            raise ValueError("Course relation has an unknown objective")
        if relation.get("kind") == "mandatory_prerequisite":
            prerequisite_children.setdefault(source, []).append(target)
    completed: set[str] = set()
    active: set[str] = set()

    def check_prerequisites(objective_id: str) -> None:
        if objective_id in active:
            raise ValueError("Strict prerequisite relations must be acyclic")
        if objective_id in completed:
            return
        active.add(objective_id)
        for child in prerequisite_children.get(objective_id, []):
            check_prerequisites(child)
        active.remove(objective_id)
        completed.add(objective_id)

    for objective_id in prerequisite_children:
        check_prerequisites(objective_id)

    if "outline" not in course:
        return
    outline = course["outline"]
    if not isinstance(outline, list):
        raise ValueError("Course outline must be a list")

    placed_objectives: set[str] = set()
    structure_ids: set[str] = set()

    def visit(entries: list, *, parent_kind: str, level: int) -> None:
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("Course outline nodes must be objects")
            kind, node_id, title = entry.get("kind"), entry.get("id"), entry.get("title")
            if not all(isinstance(value, str) and value.strip() for value in (node_id, title)):
                raise ValueError("Course outline nodes require stable IDs and titles")
            if (level == 0 and kind != "chapter") or (
                level == 1 and (parent_kind != "chapter" or kind != "unit")
            ) or level > 1:
                raise ValueError("Course outline permits chapters with units directly inside them")
            if node_id in structure_ids:
                raise ValueError(f"Duplicate course outline structure ID: {node_id}")
            structure_ids.add(node_id)

            references = entry.get("objective_refs", [])
            children = entry.get("children", [])
            if not isinstance(references, list) or not isinstance(children, list):
                raise ValueError("Course outline references and children must be lists")
            if children and kind != "chapter":
                raise ValueError("Course outline units cannot contain structure nodes")
            if not references and not children:
                raise ValueError(f"Course outline contains an empty {kind}: {node_id}")
            local_objectives: set[str] = set()
            for reference in references:
                if not isinstance(reference, str) or reference not in reference_to_objective:
                    raise ValueError(f"Course outline references an unknown objective: {reference}")
                objective_id = reference_to_objective[reference]
                if objective_id in local_objectives:
                    raise ValueError(
                        f"Course outline repeats an objective in one placement: {reference}"
                    )
                local_objectives.add(objective_id)
                placed_objectives.add(objective_id)
            if children:
                visit(children, parent_kind=kind, level=level + 1)

    visit(outline, parent_kind="course", level=0)
    missing = objective_ids - placed_objectives
    if missing:
        raise ValueError(
            "Course outline must place every objective at least once; "
            f"missing: {', '.join(sorted(missing))}"
        )


class CourseRepository:
    """Load reviewed, versioned public engineering content from the repository, not user files."""

    def __init__(self, catalog_path: Path):
        self.catalog = None
        self.example = None
        self.logic_example = None
        self.packages: dict[tuple[str, str], dict] = {}
        # A catalog and each course are independent; one damaged package must not
        # remove every other course or make the public directory unavailable.
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8-sig"))
            entries = catalog["courses"]
            if not isinstance(entries, list) or not entries:
                raise ValueError("Course catalog must contain entries")
            for field in ("id", "code"):
                if len({entry[field] for entry in entries}) != len(entries):
                    raise ValueError("Duplicate course identity")
            for entry in entries:
                UUID(entry["id"])
                UUID(entry["version_id"])
            self.catalog = catalog
        except (OSError, ValueError, KeyError, TypeError):
            return
        self._load_public_packages(catalog_path, entries)
        scope_path = catalog_path.with_name("scope-catalog.json")
        if scope_path.is_file():
            try:
                scopes = json.loads(scope_path.read_text(encoding="utf-8-sig"))["courses"]
                self._load_public_packages(scope_path, scopes)
            except (OSError, ValueError, KeyError, TypeError):
                pass
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8-sig"))
            example = json.loads(
                catalog_path.with_name("CS03.stack-example.json").read_text(encoding="utf-8-sig")
            )
            courses = catalog["courses"]
            selected = next(course for course in courses if course["code"] == "CS03")
            if (
                selected["id"] != example["course_id"]
                or selected["version_id"] != example["course_version_id"]
            ):
                raise ValueError("Course version does not match catalog")
            _validate_course_outline(example)
            activity = example["activities"][0]
            operations = tuple((op["kind"], op.get("value")) for op in activity["operations"])
            if operations != OPERATIONS or activity["standard_version"] != "stack-trace-v1":
                raise ValueError("Activity requires a new checker version")
            if activity["version"] != "CS03-STACK-01-TRACE@0.1.0":
                raise ValueError("Unsupported activity version")
            for field in ("course_id", "course_version_id"):
                UUID(example[field])
            for field in ("id", "version_id"):
                UUID(activity[field])
            self.catalog, self.example = catalog, example
        except (OSError, ValueError, KeyError, TypeError, StopIteration):
            # Readiness/capability states report unavailable, not fabricated course content.
            pass
        if self.catalog is not None:
            try:
                logic = json.loads(
                    catalog_path.with_name("CS05.logic-example.json").read_text(encoding="utf-8-sig")
                )
                selected = next(
                    course for course in self.catalog["courses"] if course["code"] == "CS05"
                )
                activity = logic["activities"][0]
                if (
                    selected["id"] != logic["course_id"]
                    or selected["version_id"] != logic["course_version_id"]
                    or logic["course_code"] != "CS05"
                    or logic["version"] != "CS05-example-0.1.0"
                    or activity["version"] != "CS05-LOGIC-01-TABLE@0.1.0"
                    or activity["standard_version"] != "propositional-table-v1"
                    or tuple(tuple(row) for row in activity["assignments"]) != LOGIC_ASSIGNMENTS
                    or activity["columns"] != ["implication", "contrapositive", "biconditional"]
                    or activity["objective_codes"] != ["CS05-LOGIC-01"]
                    or [criterion["id"] for criterion in logic["objectives"][0]["criteria"]]
                    != [
                        "implication", "contrapositive", "biconditional",
                        "explanation", "independent_transfer",
                    ]
                ):
                    raise ValueError("Logic activity requires a new checker version")
                _validate_course_outline(logic)
                for field in ("course_id", "course_version_id"):
                    UUID(logic[field])
                for field in ("id", "version_id"):
                    UUID(activity[field])
                for objective in logic["objectives"]:
                    UUID(objective["id"])
                self.logic_example = logic
            except (OSError, ValueError, KeyError, TypeError, StopIteration, IndexError):
                pass

    def _load_public_packages(self, catalog_path: Path, entries: list) -> None:
        from vault_backend.course_packages import PublicCoursePackage

        root = catalog_path.parent.resolve()
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if "package_path" not in entry:
                continue
            try:
                path = (root / entry["package_path"]).resolve()
                if not path.is_relative_to(root):
                    raise ValueError("Course package must remain inside the content directory")
                raw = json.loads(path.read_text(encoding="utf-8-sig"))
                package = PublicCoursePackage.model_validate(raw)
                if (package.course_id, package.course_version_id, package.course_code) != (
                    entry["id"], entry["version_id"], entry["code"]
                ):
                    raise ValueError("Course identity does not match catalog")
                _validate_course_outline(raw)
                self.packages[(package.course_id, package.course_version_id)] = raw
            except (OSError, ValueError, KeyError, TypeError, RecursionError):
                # Fail closed per package; private fields and drafts are never served.
                continue

    @property
    def trace_context(self):
        if self.example is None:
            return None
        example = self.example
        activity = example["activities"][0]
        return {
            "course_id": example["course_id"],
            "course_version_id": example["course_version_id"],
            "activity_id": activity["id"],
            "activity_version_id": activity["version_id"],
            "objective_ids": [
                objective["id"]
                for objective in example["objectives"]
                if objective["code"] in activity["objective_codes"]
            ],
        }

    @property
    def logic_context(self):
        if self.logic_example is None:
            return None
        logic = self.logic_example
        activity = logic["activities"][0]
        return {
            "course_id": logic["course_id"],
            "course_version_id": logic["course_version_id"],
            "activity_id": activity["id"],
            "activity_version_id": activity["version_id"],
            "objective_ids": [logic["objectives"][0]["id"]],
        }

    def get_catalog(self):
        if self.catalog is None:
            raise ApiError(503, "COURSE_CATALOG_UNAVAILABLE", "课程目录尚未加载。")
        return self.catalog

    def get_scope_catalog(self):
        return {
            "courses": [
                {
                    "id": package["course_id"],
                    "version_id": package["course_version_id"],
                    "code": package["course_code"],
                    "title": package["title"],
                    "version": package["version"],
                    "objective_count": len(package["objectives"]),
                    "chapter_count": len(package["outline"]),
                    "learning_ready": package["status"] == "learning_ready",
                }
                for package in self.packages.values()
            ]
        }

    def get_version(self, course_id: UUID, version_id: UUID):
        package = self.packages.get((str(course_id), str(version_id)))
        if package is not None:
            return package
        for example in (self.example, self.logic_example):
            if (
                example is not None
                and str(course_id) == example["course_id"]
                and str(version_id) == example["course_version_id"]
            ):
                return example
        raise ApiError(404, "COURSE_VERSION_UNAVAILABLE", "该课程版本尚未开放。")
