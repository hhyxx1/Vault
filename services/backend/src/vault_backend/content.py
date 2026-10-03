import json
from pathlib import Path
from uuid import UUID

from vault_backend.checker import OPERATIONS
from vault_backend.errors import ApiError


class CourseRepository:
    """Load reviewed, versioned public engineering content from the repository, not user files."""

    def __init__(self, catalog_path: Path):
        self.catalog = None
        self.example = None
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8-sig"))
            example = json.loads(
                catalog_path.with_name("CS03.stack-example.json").read_text(encoding="utf-8-sig")
            )
            courses = catalog["courses"]
            if len(courses) != 13 or len({course["code"] for course in courses}) != 13:
                raise ValueError("Unexpected default catalog")
            selected = next(course for course in courses if course["code"] == "CS03")
            if (
                selected["id"] != example["course_id"]
                or selected["version_id"] != example["course_version_id"]
            ):
                raise ValueError("Course version does not match catalog")
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

    def get_catalog(self):
        if self.catalog is None:
            raise ApiError(503, "COURSE_CATALOG_UNAVAILABLE", "课程目录尚未加载。")
        return self.catalog

    def get_version(self, course_id: UUID, version_id: UUID):
        if (
            self.example is None
            or str(course_id) != self.example["course_id"]
            or str(version_id) != self.example["course_version_id"]
        ):
            raise ApiError(404, "COURSE_VERSION_UNAVAILABLE", "该课程版本尚未开放。")
        return self.example
