"""Append original phased processor experiments, keeping old published snapshots."""

import copy
import importlib.util
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS06-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
REFERENCE = (ROOT / "tools/curriculum/assets/cpu_project.py").read_text(
    encoding="utf-8"
)
MAIN = """import importlib.util,json
def load(name):
    spec=importlib.util.spec_from_file_location(name,name+'.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    return m
cpu=load('cpu');source=load('program').SOURCE
words=cpu.assemble(source);r=cpu.run(words)
report={"encoded_words":words,"status":r['status'],"cycles":r['cycles'],"registers":r['registers'],"memory":r['memory'],"cache_events":r['cache_events'],"final_flush":r['final_flush'],"trace":[[t['cycle'],t['phase'],t['pc'],t['registers'],t['controls']] for t in r['trace']]}
print(json.dumps(report,sort_keys=True))
"""
CASES = [
    (
        "CS06-M06-O03",
        "processor-store",
        "修复提交阶段的存储使能",
        "LDI R0 7\nLDI R1 5\nADD R0 R1\nSTORE R0 3\nLOAD R2 3\nHALT",
        '"mem_write": op == "STORE"',
        '"mem_write": False',
        [12, 5, 12, 0],
        3,
        12,
    ),
    (
        "CS06-M05-O03",
        "processor-branch",
        "编码并运行溢出与分支程序",
        "LDI R0 255\nLDI R1 1\nADD R0 R1\nJZ R0 end\nLDI R2 99\nend: HALT",
        "registers[dest] == 0",
        "registers[dest] != 0",
        [0, 1, 0, 0],
        None,
        None,
    ),
    (
        "CS06-M08-O02",
        "processor-cache",
        "定位脏缓存冲突替换丢写",
        "LDI R0 9\nSTORE R0 0\nLOAD R1 2\nLOAD R2 0\nHALT",
        'if line["valid"] and line["dirty"]:',
        "if False:  # missing dirty eviction writeback",
        [9, 0, 9, 0],
        0,
        9,
    ),
]


def observe(module, program):
    words = module.assemble(program)
    r = module.run(words)
    return {
        "encoded_words": words,
        "status": r["status"],
        "cycles": r["cycles"],
        "registers": r["registers"],
        "memory": r["memory"],
        "cache_events": r["cache_events"],
        "final_flush": r["final_flush"],
        "trace": [
            [t["cycle"], t["phase"], t["pc"], t["registers"], t["controls"]]
            for t in r["trace"]
        ],
    }


def build():
    package = json.loads(
        (
            ROOT / "content/courses/CS06/CS06-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="27目标局部模型及原创四阶段处理器、指令编码/分支、直接映射写回缓存综合任务；完整HDL/流水线及其他课程深度待完成。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    package["sources"].append(
        {
            "id": "cornell-cache-project",
            "title": "Cornell CS3410 cache notes",
            "url": "https://www.cs.cornell.edu/courses/cs3410/2025fa/notes/caches.html",
            "locator": "direct mapping, write-back and dirty eviction",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        }
    )
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS06-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
    spec = importlib.util.spec_from_file_location(
        "author_cpu", ROOT / "tools/curriculum/assets/cpu_project.py"
    )
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    for goal, task, title, program, correct, wrong, expected, address, value in CASES:
        assert correct in REFERENCE, (task, correct)
        starter = REFERENCE.replace(correct, wrong, 1)
        bad = type(reference)("wrong_cpu")
        exec(compile(starter, "original_author_starter", "exec"), bad.__dict__)  # noqa: S102 - only original author asset
        good_result = observe(reference, program)
        bad_result = observe(bad, program)
        assert (
            good_result["registers"] == expected and good_result["status"] == "halted"
        )
        if address is not None:
            assert good_result["memory"][address] == value
        assert bad_result["registers"] != expected
        activity = next(a for a in package["activities"] if a["code"] == goal + "-CODE")
        identity = str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.2.0"))
        activity.update(version_id=identity, version=goal + "-CODE@0.2.0")
        activity["theory"] += [
            "原创ISA：16位指令，4个8位可写寄存器，16字节数据RAM与独立ROM；取指/译码/执行/提交四阶段，每阶段1教学周期，整数模256。不是Hack/x86或真实电路/流水线时序。",
            "两行直接映射数据缓存、每行1字节，写分配/写回。脏行被冲突替换前写回；终止后单独诊断flush，不计入指令周期。LOAD不写内存，STORE不写寄存器，互斥控制冲突拒绝。",
        ]
        activity["source_refs"] = sorted(
            set(activity["source_refs"] + ["cornell-cache-project"])
        )
        for row in rows:
            if row["goal"] == goal:
                row["activity"] = identity
        program_source = "SOURCE = " + repr(program) + "\n"
        initial = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": MAIN, "cpu.py": starter, "program.py": program_source},
            "stdin": "",
        }
        fixed = {**initial, "files": {**initial["files"], "cpu.py": REFERENCE}}
        activity["variants"].append(
            {
                "code": task,
                "title": title,
                "student_action": "预测程序寄存器/内存结果和逐阶段控制；运行错误版本，修改cpu.py或程序，再逐周期核对，解释缓存事件。",
                "code_request": initial,
                "reference_answer": fixed,
                "prediction_prompt": "按明示位宽与ISA推演终态、控制和缓存写回；哪一个阶段应写寄存器或内存？",
                "reflection_prompt": "由实际轨迹定位错误，不只观察终态。解释本教学周期假设、脏行写回及尚未模拟的硬件行为。",
            }
        )
        for label, request, result in [
            ("initial", initial, bad_result),
            ("repaired", fixed, good_result),
        ]:
            rows.append(
                {
                    "id": task + "/" + label,
                    "version": VERSION,
                    "goal": goal,
                    "activity": identity,
                    "task": task,
                    "request": copy.deepcopy(request),
                    "stdout": json.dumps(result, sort_keys=True) + "\n",
                    "decision": "met" if label == "repaired" else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS06/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS06-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
