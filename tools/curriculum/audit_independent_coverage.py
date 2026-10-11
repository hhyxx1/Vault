"""Audit independent-transfer coverage for data-driven code activities.

C03 acceptance: a practice-ready code objective must not rely on a single fixed
stdout. It needs either a declared semantic suite (server-private independent
inputs) or at least one migration variant (a "new condition" code_request). This
is a read-only audit over the public course manifests; it prints per-course
counts and the list of code activities that have neither channel.

Usage:
    python tools/curriculum/audit_independent_coverage.py
"""
from __future__ import annotations

import glob
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, "content", "courses")


def main() -> int:
    manifests = sorted(glob.glob(os.path.join(CONTENT, "CS*", "**", "manifest.json"), recursive=True))
    total = suite_only = variant_only = both = neither = 0
    variant_counts: list[int] = []
    variants_missing_request = 0
    objectives_total: set[str] = set()
    objectives_with_independent: set[str] = set()
    gaps: list[tuple[str, str, str, str]] = []
    per_course: dict[str, dict[str, int]] = {}

    for path in manifests:
        with io.open(path, encoding="utf-8-sig") as handle:
            manifest = json.load(handle)
        course = manifest.get("course_code", "?")
        bucket = per_course.setdefault(course, {"code": 0, "suite": 0, "variants": 0, "neither": 0})
        for activity in manifest.get("activities", []):
            if activity.get("kind") != "code":
                continue
            total += 1
            bucket["code"] += 1
            has_suite = bool(activity.get("semantic_suite"))
            variants = activity.get("variants") or []
            has_variants = len(variants) >= 1
            variant_counts.append(len(variants))
            variants_missing_request += sum(1 for v in variants if not v.get("code_request"))
            objs = activity.get("objective_codes") or []
            objectives_total.update(objs)
            if has_suite:
                suite_only += 1 if not has_variants else 0
                bucket["suite"] += 1
            if has_variants:
                variant_only += 1 if not has_suite else 0
                bucket["variants"] += 1
            if has_suite and has_variants:
                both += 1
            if not has_suite and not has_variants:
                neither += 1
                bucket["neither"] += 1
                gaps.append((course, activity.get("version_id", "?"), ",".join(objs), activity.get("title", "?")))
            else:
                objectives_with_independent.update(objs)

    print("course : code / with-suite / with-variants / neither")
    for course in sorted(per_course):
        b = per_course[course]
        print(f"  {course:6s}: {b['code']:3d} / {b['suite']:3d} / {b['variants']:3d} / {b['neither']:3d}")
    print()
    print(f"code activities total            : {total}")
    print(f"  suite only                     : {suite_only}")
    print(f"  variants only                  : {variant_only}")
    print(f"  both suite and variants        : {both}")
    print(f"  NEITHER (single fixed channel) : {neither}")
    if variant_counts:
        print(f"variants per code activity       : min {min(variant_counts)} / max {max(variant_counts)} / total {sum(variant_counts)}")
        print(f"variants missing code_request    : {variants_missing_request}")
    print(f"objectives touched by code        : {len(objectives_total)}")
    print(f"objectives with an independent channel: {len(objectives_with_independent)}")
    missing_obj = sorted(objectives_total - objectives_with_independent)
    print(f"objectives with NO independent channel: {len(missing_obj)}")
    if gaps:
        print("\nGAP activities (neither semantic suite nor migration variant):")
        for course, vid, objs, title in gaps:
            print(f"  [{course}] {objs} {vid}  {title}")
    if missing_obj:
        print("\nGAP objectives:")
        for obj in missing_obj:
            print(f"  {obj}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
