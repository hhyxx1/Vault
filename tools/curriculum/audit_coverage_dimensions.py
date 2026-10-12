"""Four-dimension coverage audit over the *current published* course versions.

The reviewer's E gate separates claims that are frequently conflated:

- ``has_variants`` : the objective's practice activity declares at least one
  migration variant carrying a real ``code_request``. This only proves a
  "new condition" *field exists* — it is NOT independent-transfer acceptance.
- ``executable``   : the objective's practice activity is runnable by an
  implemented tool (code -> isolate worker, finite_algebra -> native registry).
- ``reliable_check``: the objective has a trusted multi-input semantic suite
  (server-private independent inputs) rather than only a fixed-condition stdout
  that can be hard-coded.
- ``closed_loop``  : the objective has the full verified loop (objective result
  met *and* explanation *and* independent transfer *and* an approved human
  review). This is 0 for every objective today by design.

Archived versions are counted separately and never folded into the default
denominator. Read-only; standard library only.

Usage:
    python tools/curriculum/audit_coverage_dimensions.py
"""

from __future__ import annotations

import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, "content", "courses")
CATALOG = os.path.join(CONTENT, "scope-catalog.json")


def load_catalog() -> dict:
    with open(CATALOG, encoding="utf-8-sig") as handle:
        return json.load(handle)


def current_version_ids(catalog: dict) -> dict[str, str]:
    """course_code -> current published course_version_id."""
    return {item["code"]: item["version_id"] for item in catalog["courses"]}


def manifest_by_version(version_id: str) -> dict | None:
    for path in glob.glob(os.path.join(CONTENT, "CS*", "**", "manifest.json"), recursive=True):
        with open(path, encoding="utf-8-sig") as handle:
            manifest = json.load(handle)
        if manifest.get("course_version_id") == version_id:
            return manifest
    return None


def dimensions(manifest: dict) -> dict[str, int]:
    objectives = manifest.get("objectives") or []
    by_code = {obj.get("code"): obj for obj in objectives}
    has_variants: set[str] = set()
    executable: set[str] = set()
    reliable: set[str] = set()
    for activity in manifest.get("activities", []):
        kind = activity.get("kind")
        codes = [c for c in activity.get("objective_codes", []) if c in by_code]
        if not codes:
            continue
        variants = activity.get("variants") or []
        if any(v.get("code_request") for v in variants):
            has_variants.update(codes)
        if kind in ("code", "finite_algebra"):
            executable.update(codes)
        if activity.get("semantic_suite"):
            reliable.update(codes)
    return {
        "objectives": len(objectives),
        "has_variants": len(has_variants),
        "executable": len(executable),
        "reliable_check": len(reliable),
        "closed_loop": 0,  # never asserted: explanation/transfer/review stay needs_review
    }


def main() -> int:
    catalog = load_catalog()
    current = current_version_ids(catalog)
    totals: dict[str, int] = {
        "objectives": 0, "has_variants": 0, "executable": 0, "reliable_check": 0, "closed_loop": 0,
    }
    print("course : objectives / has_variants / executable / reliable_check / closed_loop")
    for code in sorted(current):
        manifest = manifest_by_version(current[code])
        if manifest is None:
            print(f"  {code:6s}: MISSING manifest for {current[code]}")
            continue
        dims = dimensions(manifest)
        for key in totals:
            totals[key] += dims[key]
        print(
            f"  {code:6s}: {dims['objectives']:3d} / {dims['has_variants']:3d} / "
            f"{dims['executable']:3d} / {dims['reliable_check']:3d} / {dims['closed_loop']:3d}"
        )
    print("-" * 72)
    print(
        f"  {'TOTAL':6s}: {totals['objectives']:3d} / {totals['has_variants']:3d} / "
        f"{totals['executable']:3d} / {totals['reliable_check']:3d} / {totals['closed_loop']:3d}"
    )
    print()
    print("口径：has_variants 仅证明“新条件变体字段存在”，不等于完成独立迁移验收；")
    print("reliable_check 仅统计带服务端保密独立输入的语义套件；固定 stdout 可被硬编码，不计入。")
    print("closed_loop 要求固定条件 met + 解释 met + 独立迁移 met + 教师审阅 approved，当前恒为 0。")
    archived = catalog.get("archived_courses") or []
    print()
    print(f"归档版本单列：{len(archived)} 个（不并入默认分母；旧记录按旧版本打开）。")
    print(f"额外课程包：{len(catalog.get('extra_courses', []))} 个（用于复用工具，不进默认 13 课目录）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
