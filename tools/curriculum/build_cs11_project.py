"""Original integrated Tiny project; old published versions remain immutable."""

import copy
import importlib.util
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS11-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS11-M09-O03"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))
REFERENCE = (ROOT / "tools/curriculum/assets/tiny_compiler.py").read_text(
    encoding="utf-8-sig"
)
assert "result = left - right" in REFERENCE
INITIAL = REFERENCE.replace("result = left - right", "result = right - left", 1)
MAIN = """import json,sys
import importlib.util
spec=importlib.util.spec_from_file_location('tiny','tiny.py')
tiny=importlib.util.module_from_spec(spec);spec.loader.exec_module(tiny)
run=tiny.run
result=run(sys.stdin.read())
print('tokens='+json.dumps(result['tokens'],sort_keys=True))
print('ast='+json.dumps(result['ast'],sort_keys=True))
print('instructions='+json.dumps(result['instructions'],sort_keys=True))
print(json.dumps({'source_result':result['interpreted'],'machine_result':result['compiled'],'equivalent':result['interpreted']==result['compiled']},sort_keys=True))
"""
CASES = [
    (
        "compiler-expression",
        "综合项目：定位左结合表达式的栈机减法错误",
        "print(8-3-1);print(-7/3);\n",
        [4, -2],
        [6, -2],
    ),
    (
        "compiler-loop",
        "综合新条件：变量与循环退出",
        "let x=3;while(x>0){x=x-1;}print(x);\n",
        [0],
        [-2],
    ),
    (
        "compiler-scope",
        "综合新条件：内层遮蔽与退出恢复",
        "let x=7;{let x=2;print(x);}print(x);\n",
        [2, 7],
        [2, 7],
    ),
    (
        "compiler-shortcircuit",
        "综合新条件：短路避免执行除零右操作数",
        "print(false && (1/0==0));print(true || (1/0==0));\n",
        [False, True],
        [False, True],
    ),
]


def build():
    spec = importlib.util.spec_from_file_location(
        "author_tiny", ROOT / "tools/curriculum/assets/tiny_compiler.py"
    )
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    package = json.loads(
        (
            ROOT / "content/courses/CS11/CS11-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="27目标局部实践；新增含变量/块作用域/分支/循环/短路的小语言实际解释与栈机综合实验。完整目标深度、独立迁移与审校尚缺。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    activity["theory"] += [
        "综合工件提供独立按名字查找的源解释器，以及静态绑定、跳转和栈指令执行；展示真实tokens、AST和指令。Tiny规则见课程项目规范；有限差分一致不证明全部程序正确。",
        "本次只登记M09-O03的固定条件；词法/类型/控制流等参与能力不自动达标。",
    ]
    activity["source_refs"] += ["cc-control", "cc-mutable"]
    package["sources"] += [
        {
            "id": "cc-control",
            "title": "LLVM Control Flow",
            "url": "https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl05.html",
            "locator": "control-flow lowering context; original Tiny is not Kaleidoscope or LLVM",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        },
        {
            "id": "cc-mutable",
            "title": "LLVM Mutable Variables",
            "url": "https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl07.html",
            "locator": "mutable bindings and scope context; original teaching implementation",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        },
    ]
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS11-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
        if row["goal"] == GOAL:
            row["activity"] = ACTIVITY
    for task, title, source, correct, wrong in CASES:
        actual = reference.run(source)
        assert actual["interpreted"] == actual["compiled"] == correct
        stages = "".join(
            name + "=" + json.dumps(actual[key], sort_keys=True) + "\n"
            for name, key in [
                ("tokens", "tokens"),
                ("ast", "ast"),
                ("instructions", "instructions"),
            ]
        )
        after = (
            stages
            + json.dumps(
                {
                    "source_result": correct,
                    "machine_result": correct,
                    "equivalent": True,
                },
                sort_keys=True,
            )
            + "\n"
        )
        before = (
            stages
            + json.dumps(
                {
                    "source_result": correct,
                    "machine_result": wrong,
                    "equivalent": correct == wrong,
                },
                sort_keys=True,
            )
            + "\n"
        )
        first = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": MAIN, "tiny.py": INITIAL},
            "stdin": source,
        }
        fixed = {**first, "files": {"main.py": MAIN, "tiny.py": REFERENCE}}
        activity["variants"].append(
            {
                "code": task,
                "title": title,
                "student_action": "冻结Tiny语言规则，预测阶段结果；运行、定位指令反例、修改tiny.py再比较并解释。",
                "code_request": first,
                "reference_answer": fixed,
                "prediction_prompt": "分别预测源解释输出和栈机输出，记录哪个阶段可能改变语义。",
                "reflection_prompt": "指出出错指令、修改依据和尚未验证的语言边界；不能只提交equivalent=true。",
            }
        )
        for label, request, output in [
            ("initial", first, before),
            ("repaired", fixed, after),
        ]:
            rows.append(
                {
                    "id": task + "/" + label,
                    "version": VERSION,
                    "goal": GOAL,
                    "activity": ACTIVITY,
                    "task": task,
                    "request": copy.deepcopy(request),
                    "stdout": output,
                    "decision": "met" if output == after else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS11/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS11-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
