"""Build the C01 synthetic workshop course (not one of CS01-CS13).

Purpose: prove that a brand-new course reuses the platform's registered tools
(code fixed conditions, the code semantic suite with a whitelisted oracle, and
the native finite-algebra checker) with **no backend Python whitelist edit**.

Outputs (idempotent, deterministic uuid5 identities):
  content/courses/WORKSHOP/WORKSHOP-core-0.1.0/manifest.json
  content/courses/WORKSHOP/WORKSHOP-core-0.1.0/server-expectations.json  (server-private)
and upserts the course into the ``extra_courses`` section of
content/courses/scope-catalog.json (preserving the default course list and
archived_courses).

Trusted expectations live only in the sidecar as plain data; the semantic suite
references the built-in, whitelisted ``parking_fee_three_tier`` oracle. There is
no field for uploaded grading code.
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content" / "courses"

CODE = "WORKSHOP"
VERSION = "WORKSHOP-core-0.1.0"
O1 = "WORKSHOP-M01-O1"
O2 = "WORKSHOP-M02-O1"


def sid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, name))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def source_from(course_dir: str, version: str, source_id: str) -> dict:
    manifest = json.loads(
        (CONTENT / course_dir / version / "manifest.json").read_text(encoding="utf-8")
    )
    for source in manifest["sources"]:
        if source["id"] == source_id:
            return source
    raise RuntimeError(f"missing reviewed source {source_id} in {course_dir}/{version}")


def c_source(main: str) -> dict:
    return {
        "language": "c17",
        "entry": "main.c",
        "files": {"main.c": main},
        "stdin": "",
    }


CRITERIA = [
    {
        "id": "fixed_condition",
        "title": "在指定条件下得到正确状态与输出",
        "verification": "deterministic_checker",
    },
    {
        "id": "explanation",
        "title": "解释条件与边界依据",
        "verification": "independent_review_pending",
    },
    {
        "id": "independent_transfer",
        "title": "在未公开的独立输入上保持正确",
        "verification": "deterministic_checker",
    },
]


def build() -> tuple[dict, dict, dict]:
    course_id = sid("vault:curriculum:WORKSHOP")
    course_version_id = sid(f"vault:{VERSION}")
    o1_id = sid(f"vault:{O1}")
    o2_id = sid(f"vault:{O2}")
    code_activity_id = sid(f"vault:{O1}-CODE")
    code_activity_version = sid(f"vault:{O1}-CODE:0.1.0")
    algebra_activity_id = sid(f"vault:{O2}-ALGEBRA")
    algebra_activity_version = sid(f"vault:{O2}-ALGEBRA:0.1.0")

    starter = (
        "#include <stdio.h>\nint main(void) {\n"
        "int minutes = 60, amount;\n"
        "if (minutes < 30) amount = 0;\n"
        "else if (minutes < 60) amount = 5;\n"
        "else amount = 10;\n"
        'printf("%d\\n", amount);\n'
        "return 0;\n}\n"
    )
    reference = (
        "#include <stdio.h>\nint main(void) {\n"
        "int minutes, amount;\n"
        'scanf("%d", &minutes);\n'
        "if (minutes <= 30) amount = 0;\n"
        "else if (minutes <= 60) amount = 5;\n"
        "else amount = 10;\n"
        'printf("%d\\n", amount);\n'
        "return 0;\n}\n"
    )

    sources = [
        source_from("CS01", "CS01-core-practice-0.9.0", "wg14-n1570"),
        source_from("CS05", "CS05-core-practice-0.2.0", "milne-group"),
        source_from("CS05", "CS05-core-practice-0.2.0", "auburn-algebra-native"),
    ]

    manifest = {
        "schema_version": "2.0.0",
        "course_id": course_id,
        "course_version_id": course_version_id,
        "course_code": CODE,
        "version": VERSION,
        "title": "工具复用演练工坊",
        "status": "structured_validated",
        "scope_note": (
            "合成示例课，不属于十三门默认本科课。用于验证一门全新课程可直接复用"
            "平台已注册的代码固定核验、代码语义套件与原生有限运算核验，而无需"
            "改动后端编号或 UUID 白名单；不声明完整专业培养方案，内容待审校。"
        ),
        "curriculum_review_state": "unavailable",
        "objectives": [
            {
                "id": o1_id,
                "code": O1,
                "title": "从输入计算三段计费并通过独立多输入核验",
                "criteria": CRITERIA,
            },
            {
                "id": o2_id,
                "code": O2,
                "title": "在原生有限运算表上逐公理判定一个二元结构",
                "criteria": CRITERIA,
            },
        ],
        "outline": [
            {
                "kind": "chapter",
                "id": "WORKSHOP-C1",
                "title": "复用代码核验工具",
                "children": [
                    {
                        "kind": "unit",
                        "id": "WORKSHOP-U1",
                        "title": "多输入分段计费",
                        "objective_refs": [O1],
                    }
                ],
            },
            {
                "kind": "chapter",
                "id": "WORKSHOP-C2",
                "title": "复用原生数学工具",
                "children": [
                    {
                        "kind": "unit",
                        "id": "WORKSHOP-U2",
                        "title": "有限二元运算表",
                        "objective_refs": [O2],
                    }
                ],
            },
        ],
        "relations": [],
        "sources": sources,
        "activities": [
            {
                "id": code_activity_id,
                "version_id": code_activity_version,
                "code": f"{O1}-CODE",
                "version": f"{O1}-CODE@0.1.0",
                "objective_codes": [O1],
                "kind": "code",
                "title": "把分段计费改写成读取输入的通用程序",
                "student_action": (
                    "先预测 30/60 端点输出，再把程序改为从标准输入读取分钟数；"
                    "提交独立语义核验，用未公开的多组输入检验是否只是硬编码 30/60。"
                ),
                "theory": [
                    "单个输入通过只说明该输入未暴露问题；端点及其两侧用于暴露区间缺口。",
                    "把常量改为读取输入后，仍需在多组独立输入上验证分支条件是否包含端点。",
                ],
                "starter": "先写预测，再把 main.c 改为 scanf 读取分钟数后运行。",
                "source_refs": ["wg14-n1570"],
                "availability": "practice_ready",
                "completion_limit": (
                    "只比较指定输入的状态和输出；硬编码可满足可见固定条件，"
                    "不能据此证明一般正确性、解释或独立迁移。"
                ),
                "check_version": "code-fixed-condition-v1",
                "code_request": c_source(starter),
                "reference_answer": c_source(reference),
                "prediction_prompt": "逐步预测分支变量、输出与退出状态，并说明依据。",
                "reflection_prompt": (
                    "记录预测与真实结果的差异、把 < 改为 <= 的原因，以及为何固定输出"
                    "仍不能证明整体正确。"
                ),
                "semantic_suite": {
                    "standard_version": "code-semantic-suite-v1",
                    "oracle_id": "parking_fee_three_tier",
                    "comparator": "integer",
                    "language": "c17",
                    "visible_cases": [
                        {"code": "visible-30", "stdin": "30\n"},
                        {"code": "visible-60", "stdin": "60\n"},
                    ],
                    "independent_case_count": 2,
                    "scope_note": (
                        "合成课复用平台三段计费 oracle 在多组分钟数上核验；独立输入"
                        "仅存服务端，只针对 30/60 硬编码常量的程序会在独立输入上失败。"
                    ),
                },
            },
            {
                "id": algebra_activity_id,
                "version_id": algebra_activity_version,
                "code": f"{O2}-ALGEBRA",
                "version": f"{O2}-ALGEBRA@0.1.0",
                "objective_codes": [O2],
                "kind": "finite_algebra",
                "title": "逐公理检查有限运算表",
                "availability": "practice_ready",
                "student_action": (
                    "先填写性质预测，再核验完整表；展开具体反例，修改表并写出原因后"
                    "以新版本重试。无需编写代码。"
                ),
                "theory": [
                    "封闭要求每个有序对结果都在标签集合内。",
                    "群须满足结合律、双侧单位元和每个元素的双侧逆元，交换律不是必要条件。",
                ],
                "starter": "直接在表格中编辑整数标签；记录修改前后的判断和反例。",
                "source_refs": ["milne-group", "auburn-algebra-native"],
                "completion_limit": (
                    "仅核对给定完整有限表与预测；解释、独立新结构及一般证明需另行验证。"
                ),
                "check_version": "finite-algebra-exhaustive-v1",
                "algebra_prompt": {
                    "mode": "group",
                    "table": [[0, 1], [1, 2]],
                    "second_table": None,
                    "mapping": None,
                },
                "reference_note": "将初始表的 1·1 改成 0，得到模 2 加法表；仍需重新检查全部公理。",
            },
        ],
    }

    sidecar = {
        "course_id": course_id,
        "course_version_id": course_version_id,
        "course_code": CODE,
        "fixed_conditions": [
            {
                "activity_version_id": code_activity_version,
                "objective_code": O1,
                "task_code": "base",
                "stdin": "60\n",
                "status": "success",
                "stdout": "5\n",
                "stderr": "",
            }
        ],
        "semantic_suites": [
            {
                "activity_version_id": code_activity_version,
                "objective_code": O1,
                "independent_cases": [
                    {"code": "indep-31", "stdin": "31\n"},
                    {"code": "indep-61", "stdin": "61\n"},
                ],
            }
        ],
    }

    scope_entry = {
        "id": course_id,
        "code": CODE,
        "title": manifest["title"],
        "version_id": course_version_id,
        "version": VERSION,
        "package_path": f"{CODE}/{VERSION}/manifest.json",
        "full_course_available": False,
    }
    return manifest, sidecar, scope_entry


def main() -> None:
    manifest, sidecar, scope_entry = build()
    version_dir = CONTENT / CODE / VERSION
    write_json(version_dir / "manifest.json", manifest)
    write_json(version_dir / "server-expectations.json", sidecar)

    scope_path = CONTENT / "scope-catalog.json"
    scope = json.loads(scope_path.read_text(encoding="utf-8-sig"))
    # Keep the platform-default course list exactly as declared (13 courses);
    # register the synthetic workshop under extra_courses, alongside archived.
    scope["courses"] = sorted(
        [c for c in scope["courses"] if c.get("code") != CODE],
        key=lambda c: c["code"],
    )
    extra = [c for c in scope.get("extra_courses", []) if c.get("code") != CODE]
    extra.append(scope_entry)
    scope["extra_courses"] = sorted(extra, key=lambda c: c["code"])
    write_json(scope_path, scope)
    print(f"wrote {version_dir} and upserted extra_courses entry {CODE}")


if __name__ == "__main__":
    main()
