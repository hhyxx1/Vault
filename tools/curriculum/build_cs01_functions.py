"""Author bounded function tasks with independent expected outputs."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
VERSION = str(uuid5(NAMESPACE_URL, "vault:CS01-core-practice-0.5.0"))
p = json.loads(
    (ROOT / "content/courses/CS01/CS01-core-practice-0.4.0/manifest.json").read_text(
        encoding="utf-8"
    )
)
p.update(
    course_version_id=VERSION,
    version="CS01-core-practice-0.5.0",
    scope_note="30 个目标保留完整分母；前五模块十五项实践提供受限固定条件核验。解释、独立迁移及整课验收继续建设。",
)
rows, rules = [], []


def req(functions, main):
    return {
        "language": "c17",
        "entry": "main.c",
        "files": {
            "main.c": "#include <stdio.h>\n"
            + functions
            + "\nint main(void) {\n"
            + main
            + "\nreturn 0;\n}\n"
        },
        "stdin": "",
    }


def add(number, title, action, theory, hints, cases):
    goal = f"CS01-M05-O{number:02d}"
    code = goal + "-CODE"
    identity = str(uuid5(NAMESPACE_URL, "vault:" + code + ":0.1.0"))
    activity = {
        "id": str(uuid5(NAMESPACE_URL, "vault:" + code)),
        "version_id": identity,
        "code": code,
        "version": code + "@0.1.0",
        "objective_codes": [goal],
        "kind": "code",
        "title": title,
        "student_action": action,
        "theory": theory,
        "starter": "记录调用前后状态，先预测，再执行和修正。",
        "source_refs": ["wg14-n1570-functions"],
        "availability": "practice_ready",
        "completion_limit": "只比较受限固定输入的真实状态和输出。未自动复核解释或独立迁移，硬编码输出不证明一般正确性。",
        "code_request": cases[0][3],
        "reference_answer": cases[0][4],
        "prediction_prompt": "按调用次序预测参数、局部值、返回值和输出。",
        "reflection_prompt": "解释哪一个调用或局部状态与预测不同，保留修正理由和下一项边界测试。",
        "hints": hints,
        "variants": [],
        "check_version": "cs01-fixed-condition-v1",
    }
    for task, label, instruction, initial, corrected, before, after in cases:
        if task != "base":
            activity["variants"].append(
                {
                    "code": task,
                    "title": label,
                    "student_action": instruction,
                    "code_request": initial,
                    "prediction_prompt": activity["prediction_prompt"],
                    "reflection_prompt": activity["reflection_prompt"],
                }
            )
        rules.append([goal, task, "", "success", after, ""])
        for label, request, output in [
            ("initial", initial, before),
            ("repaired", corrected, after),
        ]:
            rows.append(
                {
                    "id": goal + "/" + task + "/" + label,
                    "version": VERSION,
                    "goal": goal,
                    "activity": identity,
                    "task": task,
                    "request": request,
                    "stdout": output,
                    "decision": "met" if output == after else "not_met",
                }
            )
    p["activities"].append(activity)
    next(o for o in p["objectives"] if o["code"] == goal)["criteria"] = [
        {
            "id": "fixed_condition",
            "title": "本次任务的固定条件",
            "verification": "deterministic_checker",
        },
        {
            "id": "explanation",
            "title": "解释原理、差异与适用范围",
            "verification": "independent_review_pending",
        },
        {
            "id": "independent_transfer",
            "title": "在独立新条件下验证",
            "verification": "independent_review_pending",
        },
    ]


def increment(x, repair=False):
    return req(
        "int next(int value) { value++; return value; }",
        f"int original={x};\n"
        + ("original=next(original);" if repair else "next(original);")
        + '\nprintf("%d\\n",original);',
    )


add(
    1,
    "调用返回值不会自动改写实参",
    "函数 next 返回输入加一。原值 3，任务要求调用后输出 4；观察忽略返回值的结果，修正赋值。范围限定 -5 至 5。",
    [
        "此任务传递整数值，函数内参数的修改不改变 main 的局部对象；调用者必须明确使用返回值。"
    ],
    ["分别写出函数参数和 main 中 original 的值。", "查看 next 的返回值是否被使用。"],
    [
        ("base", "返回值", "3 变为 4", increment(3), increment(3, True), "3\n", "4\n"),
        (
            "negative-value",
            "负值调用",
            "输入 -2，期望 -1；重新预测调用前后两处值。",
            increment(-2),
            increment(-2, True),
            "-2\n",
            "-1\n",
        ),
    ],
)


def locals(n, repair=False):
    functions = 'int observe(int seed) { int value=seed; { int value=seed+10; printf("inner=%d\\n",value); } printf("outer=%d\\n",value); return value; }'
    main = f'int first=observe({n});\nint second=observe({n + 1});\nprintf("returns=%d %d\\n",first,second);'
    if not repair:
        functions = functions.replace("int value=seed+10;", "value=seed+10;")
    return req(functions, main)


add(
    2,
    "同名局部变量属于哪一层",
    "需要内层显示 seed+10、外层仍显示 seed；连续调用 seed=2、3，保留每层轨迹。初始作品误改了外层值。不得返回局部地址或读取失效对象。",
    [
        "内层同名声明在其作用域内隐藏外层名字；本任务用逐层输出区分声明新对象与修改既有对象。"
    ],
    ["确认花括号内是新声明还是赋值。", "连续两次调用分别从各自 seed 初始化。"],
    [
        (
            "base",
            "两层轨迹",
            "2、3 连续调用",
            locals(2),
            locals(2, True),
            "inner=12\nouter=12\ninner=13\nouter=13\nreturns=12 13\n",
            "inner=12\nouter=2\ninner=13\nouter=3\nreturns=2 3\n",
        ),
        (
            "zero-seed",
            "零值与下一次调用",
            "seed 为 0 和 1，分别跟踪内外两层。",
            locals(0),
            locals(0, True),
            "inner=10\nouter=10\ninner=11\nouter=11\nreturns=10 11\n",
            "inner=10\nouter=0\ninner=11\nouter=1\nreturns=0 1\n",
        ),
    ],
)


def factorial(n, repair=False):
    functions = (
        'int factorial(int n) {\nprintf("enter=%d\\n",n);\nif(n==0) return '
        + ("1" if repair else "0")
        + ';\nint result=n*factorial(n-1);\nprintf("leave=%d result=%d\\n",n,result);\nreturn result;\n}'
    )
    return req(
        functions,
        f'int n={n};\nif(n<0 || n>5) {{ puts("rejected"); return 0; }}\nint result=factorial(n);\nprintf("result=%d\\n",result);',
    )


add(
    3,
    "递归到达基例后怎样返回",
    "限定 n 为 0–5，n=3 的结果应为 6。先画调用与返回轨迹，修复错误基例；非法输入在调用前拒绝，避免无界递归或大数溢出。",
    [
        "递归任务必须给出基例和朝基例推进的参数；本例返回值沿调用链逐层计算，不把一次递归运行视为一般终止证明。"
    ],
    [
        "阶乘 0 的任务定义是 1。",
        "比较 enter 与 leave 的顺序；计算下一层返回后本层的结果。",
    ],
    [
        (
            "base",
            "三层递归",
            "3 的阶乘",
            factorial(3),
            factorial(3, True),
            "enter=3\nenter=2\nenter=1\nenter=0\nleave=1 result=0\nleave=2 result=0\nleave=3 result=0\nresult=0\n",
            "enter=3\nenter=2\nenter=1\nenter=0\nleave=1 result=1\nleave=2 result=2\nleave=3 result=6\nresult=6\n",
        ),
        (
            "zero-base",
            "直接到达基例",
            "n=0，不进入递归分支，期望 result=1。",
            factorial(0),
            factorial(0, True),
            "enter=0\nresult=0\n",
            "enter=0\nresult=1\n",
        ),
        (
            "reject-negative",
            "调用前拒绝负数",
            "n=-1，要求 rejected，不能调用递归函数。",
            factorial(-1),
            factorial(-1, True),
            "rejected\n",
            "rejected\n",
        ),
        (
            "reject-large",
            "限制可表示范围",
            "n=6 超出教学范围，要求 rejected；不对溢出生成固定答案。",
            factorial(6),
            factorial(6, True),
            "rejected\n",
            "rejected\n",
        ),
    ],
)
p["sources"].append(
    {
        "id": "wg14-n1570-functions",
        "title": "WG14 N1570：调用与作用域（C11 委员会草案）",
        "url": "https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf",
        "locator": "6.2.1；6.5.2.2；6.8.6.4；非 C17 正式标准",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)
for name, value in [
    ("content/courses/CS01/CS01-core-practice-0.5.0/manifest.json", p),
    ("services/backend/fixtures/course-code/CS01-functions.json", rows),
    ("services/backend/fixtures/course-code/CS01-functions-rules.json", rules),
]:
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
print(VERSION)
