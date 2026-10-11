#!/usr/bin/env python3
"""Audit the 13-course TASK_BOARD against the latest course packages.

只读客观审计并（加 --write 时）校准
``document/handoff/13-course-delivery-2026-10-10/TASK_BOARD.csv``。

做法：扫描每门课最新 practice manifest（外加 CS03 结构化样例与 CS05 逻辑
样例），按模块聚合目标数、活动类型、检查版本、变体数、图谱关系端点覆盖，
把 122 个模块的八项状态（source/theory/activity/check/variant/graph/
integration/review）与 module_status 从 ``needs_audit`` 校准为能被仓库文件
直接支撑的取值：

* 有在位产物但未达闭环（Q0-Q5 / 八项未齐）记 ``in_progress``；
* 来源未逐一联网核验记 ``needs_audit``；
* 专业审校、真实模型与生产验收属外部不可得依赖，记 ``blocked_external``。

脚本不把任何模块或任何一项标为 ``verified``，也不臆造来源、审校或学习效果。
仅依赖标准库，可重复执行（幂等）。
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOARD = ROOT / "document" / "handoff" / "13-course-delivery-2026-10-10" / "TASK_BOARD.csv"
COURSES_DIR = ROOT / "content" / "courses"

LATEST = {
    "CS01": "0.9.0",
    "CS02": "0.2.0",
    "CS03": "0.2.0",
    "CS04": "0.2.0",
    "CS05": "0.2.0",
    "CS06": "0.2.0",
    "CS07": "0.1.0",
    "CS08": "0.1.0",
    "CS09": "0.1.0",
    "CS10": "0.2.0",
    "CS11": "0.2.0",
    "CS12": "0.2.0",
    "CS13": "0.3.0",
}

# 非编程 / 强原生学科：code（打印或模型）不能替代真实操作。
NATIVE_GAP = {
    "CS05": "离散数学为非编程课：除 M07 已建原生有限运算表/映射穷举实验外，其余模块仍以 code 有限观察为主，需补真值表、图论、证明等原生确定性工作台。",
    "CS06": "计算机组成原理为非编程课：需 HDL/电路、四阶段处理器与缓存的原生可操作模型，不能仅以打印或固定输出模拟硬件。",
    "CS07": "操作系统需在真实系统接口上产出 trace 与作业观察器，教学模型不得替代对真实 OS 行为的观察与独立核验。",
    "CS08": "计算机网络需真实抓包、网桥/VLAN、FRR 与协议重建实验，不能用打印模拟报文与连接。",
    "CS09": "数据库需在真实 PG18 上完成多连接、备份恢复与综合项目，FD/WAL 明示模型需配套真实观察。",
}

# 课程级工程样例（独立 objective，尚未回填正式模块大纲）。
ENGINEERING_SAMPLES = {
    "CS03": "另有独立结构化工程样例（未回填 M01-M10 正式目标）：CS03-STACK-01/02、CS03-QUEUE-01/02，共 5 个 trace/judge 活动。",
    "CS05": "另有独立逻辑工程样例 CS05-LOGIC-01/02 真值表（engineering_example，pending review）。",
}

UPGRADE_NOTE = (
    "固定条件核验只比较本次受限输入的状态/输出，不证明一般正确；需升级为语义/不变量/轨迹/独立输入核验，"
    "并补齐替代正确解、两类有意义错误与欺骗检查器的变体矩阵；解释与独立迁移仍待独立复核。"
)


def module_of(code: str) -> str:
    match = re.match(r"(CS\d+-M\d+)", code)
    return match.group(1) if match else code


def load_course(course: str, version: str) -> dict:
    path = COURSES_DIR / course / f"{course}-core-practice-{version}" / "manifest.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def collect(course: str, version: str) -> dict:
    manifest = load_course(course, version)
    activities_by_objective: dict[str, list[dict]] = defaultdict(list)
    for activity in manifest.get("activities", []):
        for objective_code in activity.get("objective_codes", []):
            activities_by_objective[objective_code].append(activity)

    relation_endpoints: set[str] = set()
    for relation in manifest.get("relations", []):
        for key in ("from", "to", "source", "target"):
            if relation.get(key):
                relation_endpoints.add(relation[key])

    modules: dict[str, dict] = {}
    for objective in manifest.get("objectives", []):
        mid = module_of(objective["code"])
        bucket = modules.setdefault(
            mid,
            {"objectives": [], "covered": 0, "kinds": Counter(), "checks": set(), "variants": 0, "relations": 0},
        )
        bucket["objectives"].append(objective["code"])
        acts = activities_by_objective.get(objective["code"], [])
        if acts:
            bucket["covered"] += 1
        for activity in acts:
            bucket["kinds"][activity.get("kind", "?")] += 1
            if activity.get("check_version"):
                bucket["checks"].add(str(activity["check_version"]))
            variants = activity.get("variants")
            if isinstance(variants, list):
                bucket["variants"] += len(variants)
        if objective["code"] in relation_endpoints:
            bucket["relations"] += 1

    return {
        "version": version,
        "package_ref": f"content/courses/{course}/{course}-core-practice-{version}/manifest.json",
        "course_version_id": manifest.get("course_version_id", ""),
        "status": manifest.get("status", ""),
        "review": manifest.get("curriculum_review_state", ""),
        "modules": modules,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="把审计结果写回 TASK_BOARD.csv")
    args = parser.parse_args()

    audit = {course: collect(course, version) for course, version in LATEST.items()}

    with BOARD.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    stats = Counter()
    for row in rows:
        course = row["course_code"]
        mid = row["module_id"]
        info = audit[course]
        module = info["modules"].get(mid)
        if module is None:
            row["module_status"] = "needs_audit"
            row["blocker"] = "最新课程包未找到该模块，需人工核对模块编号或包版本。"
            stats["missing_module"] += 1
            continue

        total = len(module["objectives"])
        covered = module["covered"]
        kinds = dict(module["kinds"])
        kinds_text = ",".join(f"{kind}:{count}" for kind, count in sorted(kinds.items()))
        checks = ",".join(sorted(module["checks"])) or "无"
        relations = module["relations"]
        variants = module["variants"]
        native = "finite_algebra" in kinds

        # 客观快照引用，统一指向最新包。
        row["snapshot_package_ref"] = info["package_ref"]
        row["snapshot_course_version_id"] = info["course_version_id"]

        # 八项 + 总状态：有在位产物但未闭环一律 in_progress；
        # 来源未联网核验 needs_audit；专业审校/真实模型/生产为外部依赖 blocked_external。
        row["module_status"] = "in_progress"
        row["source_status"] = "needs_audit"
        row["theory_status"] = "in_progress"
        row["activity_status"] = "in_progress"
        row["check_status"] = "in_progress"
        row["variant_status"] = "in_progress"
        row["graph_status"] = "in_progress"
        row["integration_status"] = "in_progress"
        row["review_status"] = "blocked_external"
        stats["modules_in_progress"] += 1
        stats[f"{course}_in_progress"] += 1
        if native:
            stats["native_finite_algebra_modules"] += 1
        if relations == 0:
            stats["graph_uncovered_modules"] += 1

        evidence = (
            f"2026-10-11 只读审计（最新 practice {info['version']}，包状态 {info['status']}/审校 {info['review']}）："
            f"目标 {covered}/{total} 绑定 practice_ready 活动；活动类型 {kinds_text}；检查版本 {checks}；"
            f"变体合计 {variants}；图谱关系端点覆盖 {relations}/{total} 目标。"
        )
        if course in ENGINEERING_SAMPLES:
            evidence += ENGINEERING_SAMPLES[course]
        row["evidence"] = evidence

        blockers = [
            "仅受限/局部实践：" + UPGRADE_NOTE,
            "专业审校 unavailable、真实模型与生产验收为外部不可得依赖。",
        ]
        if course in NATIVE_GAP:
            blockers.append(NATIVE_GAP[course])
        if course == "CS03":
            blockers.append("正式 M01-M10 目标目前仅 code；栈/队列/括号原生结构化 trace 仅在独立工程样例验证，尚未回填正式模块。")
        if native:
            blockers.append("M07 原生有限运算表/映射穷举核验已贯通（含确定性检查器与端到端 e2e），但变体数为 0，解释与独立迁移仍待复核。")
        if relations == 0:
            blockers.append(f"图谱关系未覆盖本模块目标（0/{total}），需补先修/支撑关系。")
        row["blocker"] = " ".join(blockers)

        if course == "CS03":
            next_action = "P2：把已验证的通用 trace/结构化工作台与链队列、括号检查器回填到正式 M 模块目标，再补语义核验与变体。"
        elif course in NATIVE_GAP:
            next_action = "P2/P3：先建该学科原生确定性工作台与检查器（不得用打印冒充实操），再做语义/不变量核验、变体矩阵与图谱桥接。"
        else:
            next_action = "P1/P3：升级固定 stdout 核验为语义/不变量/轨迹/独立输入核验，补替代正确解、两类错误与欺骗变体，并完成综合项目与图谱桥接。"
        next_action += " 来源需逐一联网核验（source 仍 needs_audit），审校与真实模型联调保持 blocked_external。"
        row["next_action"] = next_action
        row["updated_at"] = "2026-10-11"
        row["owner"] = "doubao-executor"

    print(f"模块行数: {len(rows)}")
    for key in sorted(stats):
        print(f"  {key}: {stats[key]}")

    if not args.write:
        print("\n[dry-run] 未写回；确认后加 --write 落盘。")
        return 0

    with BOARD.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"\n已写回 {BOARD.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
