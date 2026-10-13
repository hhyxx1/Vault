"""Canonical student-authored content for manual review, excluding imported verdicts."""

import hashlib
import json

FIELDS = {
    "course_attempt": ("courseCode", "objectiveId", "activityVersion", "rows", "explanation"),
    "structured_attempt": ("courseCode", "objectiveCode", "activityVersion", "kind",
                           "traceRows", "bracketRows", "explanation"),
    "algebra_attempt": ("courseCode", "objectiveCode", "courseVersionId", "activityVersionId",
                        "activityVersion", "mode", "table", "secondTable", "mapping",
                        "predictions", "explanation"),
}


def manual_content(kind: str, payload: dict) -> dict:
    return {key: payload.get(key) for key in FIELDS[kind]}


def content_hash(content: dict) -> str:
    return hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()
