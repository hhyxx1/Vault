"""Prepare native finite-table content; publication is a separate tested step."""

import copy
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS05-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))


def identity(label):
    return str(uuid5(NAMESPACE_URL, "vault:" + label))


def build_package():
    package = copy.deepcopy(
        json.loads(
            (
                ROOT / "content/courses/CS05/CS05-core-practice-0.1.0/manifest.json"
            ).read_text(encoding="utf-8")
        )
    )
    package["course_version_id"], package["version"] = VERSION, NAME
    package["scope_note"] += (
        " M07新增原生有限运算表及映射实验，不要求编程；保留代码作为可选探索。其他模块的原生操作、独立迁移及整课验收仍待完成。"
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    package["sources"].append(
        {
            "id": "auburn-algebra-native",
            "title": "Auburn Abstract Algebra II",
            "url": "https://webhome.auburn.edu/~holmerr/absalg2.pdf",
            "locator": "1.1 ring axioms; 2.6 field; 4.2–4.3 finite modular rings; 6.1 preservation of operations",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        }
    )
    cases = [
        (
            "CS05-M07-O01",
            "group",
            "逐公理检查有限运算表",
            [[0, 1], [1, 2]],
            None,
            None,
            [
                "封闭要求每个有序对结果都在标签集合内；先指出越界的格子。",
                "封闭不成立时不能把嵌套运算当作已定义；结合律显示未检查。",
                "群须满足结合律、双侧单位元和每个元素的双侧逆元，交换律不是必要条件。",
            ],
        ),
        (
            "CS05-M07-O02",
            "ring",
            "区分环、单位元与域",
            [[(a + b) % 3 for b in range(3)] for a in range(3)],
            [[0, 0, 0], [0, 0, 2], [0, 2, 1]],
            None,
            [
                "加法须是交换群；乘法须结合，并满足左右分配律。",
                "本实验单独报告乘法单位元；允许零环有零等于一的平凡单位元，但域要求一与零不同。Auburn讲义的ring with identity约定另要求一不等于零。",
                "域还要求乘法交换及所有非零元素有乘法逆元；存在零因子可否定域。",
            ],
        ),
        (
            "CS05-M07-O03",
            "homomorphism",
            "双射是否保持运算",
            [[(a + b) % 3 for b in range(3)] for a in range(3)],
            [[(a + b) % 3 for b in range(3)] for a in range(3)],
            [1, 0, 2],
            [
                "逐有序对比较f(a·b)与f(a)·f(b)，不能仅比较集合大小。",
                "保持单运算、单射与满射分别检查；群同构要求两侧是群且映射是双射群同态。",
                "本实验不是环同态检查；环同态还须同时保持加法和乘法。",
            ],
        ),
    ]
    for goal, mode, title, table, second, mapping, theory in cases:
        code = goal + "-ALGEBRA"
        package["activities"].append(
            {
                "id": identity(code),
                "version_id": identity(code + ":0.1.0"),
                "code": code,
                "version": code + "@0.1.0",
                "objective_codes": [goal],
                "kind": "finite_algebra",
                "title": title,
                "availability": "practice_ready",
                "student_action": "先填写性质预测，再核验完整表；展开具体反例，修改表或映射，写出原因后以新版本重试。无需编写代码。",
                "theory": theory,
                "starter": "直接在表格中编辑整数标签；记录修改前后的判断和反例。",
                "source_refs": ["milne-group", "auburn-algebra-native"],
                "completion_limit": "仅核对给定完整有限表与预测。解释、独立新结构及一般证明需另行验证，不自动确认整章掌握。",
                "check_version": "finite-algebra-exhaustive-v1",
                "algebra_prompt": {
                    "mode": mode,
                    "table": table,
                    "second_table": second,
                    "mapping": mapping,
                },
            }
        )
    notes = {
        "CS05-M07-O01-ALGEBRA": "将初始表的1·1改成0，得到模2加法表；仍需重新检查全部公理。",
        "CS05-M07-O02-ALGEBRA": "将初始乘法表的1·1改成1，得到模3的加法和乘法；非零元素的逆元也必须检查。",
        "CS05-M07-O03-ALGEBRA": "将初始映射改成f(0)=0、f(1)=1、f(2)=2，得到相同模3加法群间的恒等映射；不能只凭双射断言同构。",
    }
    for activity in package["activities"]:
        if activity["code"] in notes:
            activity["reference_note"] = notes[activity["code"]]
    return package


if __name__ == "__main__":
    target = ROOT / f"content/courses/CS05/{NAME}/manifest.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(build_package(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS05-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
    (ROOT / "services/backend/fixtures/course-code/CS05-algebra.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("Prepared unpublished native course package", VERSION)
