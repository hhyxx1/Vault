"""Four-dimension acceptance audit over the *current published* course versions.

The round-2 E gate separates four claims that are easy to conflate:

- ``a.structure``   : static structural coverage — the objective exists in the
  current published definition. This says nothing about teaching quality.
- ``b.mechanism``   : a verification *mechanism* is declared (a fixed-condition
  check version or a trusted multi-input semantic suite). A declared mechanism
  is not proof that any real execution happened.
- ``c.executed``    : a *real* execution is recorded for the objective, with a
  traceable reference (a test/acceptance artefact). Never inferred from the
  activity ``kind``; shown as 未验证 when there is no evidence.
- ``d.accepted``    : full product closed-loop acceptance (objective result met
  *and* explanation *and* independent transfer *and* the applicable human-review
  requirement satisfied), again evidence-driven, never a hardcoded zero.

Evidence for (c)/(d) is read from a committed JSON file so the numbers are
traceable; without it both dimensions report 未验证 rather than 0.

Archived versions are counted separately and never folded into the default
denominator. Read-only; standard library only.

Usage:
    python tools/curriculum/audit_coverage_dimensions.py [--evidence PATH]
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, "content", "courses")
CATALOG = os.path.join(CONTENT, "scope-catalog.json")
DEFAULT_EVIDENCE = os.path.join(
    ROOT, "document", "handoff", "course-acceptance-evidence.json"
)

UNVERIFIED = "未验证"


def load_catalog() -> dict:
    with open(CATALOG, encoding="utf-8-sig") as handle:
        return json.load(handle)


def load_evidence(path: str) -> dict:
    if not path or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8-sig") as handle:
        return json.load(handle)


def manifest_by_version(version_id: str) -> dict | None:
    for path in glob.glob(os.path.join(CONTENT, "CS*", "**", "manifest.json"), recursive=True):
        with open(path, encoding="utf-8-sig") as handle:
            manifest = json.load(handle)
        if manifest.get("course_version_id") == version_id:
            return manifest
    return None


def dimensions(manifest: dict, evidence: dict) -> dict:
    """Per-objective counts for the four dimensions (evidence-driven c/d)."""
    objectives = [obj.get("code") for obj in (manifest.get("objectives") or [])]
    declared: set[str] = set()
    mechanism: set[str] = set()
    for activity in manifest.get("activities", []):
        codes = [c for c in activity.get("objective_codes", []) if c in objectives]
        if not codes:
            continue
        declared.update(codes)
        if activity.get("semantic_suite") or activity.get("check_version"):
            mechanism.update(codes)
    matching = {code: row for code, row in evidence.items() if isinstance(row, dict)
                and row.get("course_version_id") == manifest.get("course_version_id")}
    executed = {code for code in objectives if (matching.get(code) or {}).get("executed_ref")}
    accepted = {
        code
        for code in objectives
        if code in executed and (matching.get(code) or {}).get("accepted_ref")
        and (matching.get(code) or {}).get("accepted") is True
    }
    return {
        "structure": len(objectives),
        "mechanism": len(mechanism),
        "executed": len(executed),
        "accepted": len(accepted),
        "evidence_present": bool(evidence),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence", default=DEFAULT_EVIDENCE)
    args = parser.parse_args()
    catalog = load_catalog()
    evidence = load_evidence(args.evidence)
    current = {item["code"]: item["version_id"] for item in catalog["courses"]}
    totals = {"structure": 0, "mechanism": 0, "executed": 0, "accepted": 0}
    print("course : a.structure / b.mechanism / c.executed / d.accepted")
    for code in sorted(current):
        manifest = manifest_by_version(current[code])
        if manifest is None:
            print(f"  {code:6s}: MISSING manifest for {current[code]}")
            continue
        dims = dimensions(manifest, evidence)
        for key in totals:
            totals[key] += dims[key]
        executed = dims["executed"] if evidence else UNVERIFIED
        accepted = dims["accepted"] if evidence else UNVERIFIED
        print(
            f"  {code:6s}: {dims['structure']:3d} / {dims['mechanism']:3d} / "
            f"{executed!s:>6} / {accepted!s:>6}"
        )
    print("-" * 72)
    executed_label = totals["executed"] if evidence else UNVERIFIED
    accepted_label = totals["accepted"] if evidence else UNVERIFIED
    print(
        f"  {'TOTAL':6s}: {totals['structure']:3d} / {totals['mechanism']:3d} / "
        f"{executed_label!s:>6} / {accepted_label!s:>6}"
    )
    print()
    print("口径：a 仅声明范围；b 仅声明“存在核验机制”，不等于执行过；")
    print("c 只统计有可追溯执行证据的目标，绝不按 kind 推断；")
    print("d 只统计有产品闭环验收证据且 accepted=true 的目标；")
    print("无证据文件或目标未登记时显示“未验证”，不以写死的 0 冒充验收。")
    if not evidence:
        print(f"（证据文件不存在：{args.evidence}）")
    archived = catalog.get("archived_courses") or []
    print()
    print(f"归档版本单列：{len(archived)} 个（不并入默认分母；旧记录按旧版本打开）。")
    print(f"额外课程包：{len(catalog.get('extra_courses', []))} 个（复用工具，不进默认 13 课目录）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
