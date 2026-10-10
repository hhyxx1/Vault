"""Rebuild immutable CS01 control-flow authoring artifacts, not learner code."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
VERSION = "fc44376d-c32e-58ed-a4cf-9f98b5a80811"
package = json.loads(
    (ROOT / "content/courses/CS01/CS01-core-practice-0.3.0/manifest.json").read_text(
        encoding="utf-8"
    )
)
package.update(
    course_version_id=VERSION,
    version="CS01-core-practice-0.4.0",
    scope_note="30 个目标保留完整分母；前四模块十二项实践提供固定条件核验。解释、独立迁移及整课验收继续建设。",
)
fixtures, rules = [], []


def request(body, stdin=""):
    return {
        "language": "c17",
        "entry": "main.c",
        "files": {
            "main.c": "#include <stdio.h>\nint main(void) {\n"
            + body
            + "\nreturn 0;\n}\n"
        },
        "stdin": stdin,
    }


def add(goal, title, action, theory, starter, answer, expected, variants, hints):
    code = goal + "-CODE"
    activity_id = str(uuid5(NAMESPACE_URL, "vault:" + code + ":0.1.0"))
    activity = {
        "id": str(uuid5(NAMESPACE_URL, "vault:" + code)),
        "version_id": activity_id,
        "code": code,
        "version": code + "@0.1.0",
        "objective_codes": [goal],
        "kind": "code",
        "title": title,
        "student_action": action,
        "theory": theory,
        "starter": "先写预测，再运行 main.c；保留修正理由和每次结果。",
        "source_refs": ["wg14-n1570-control", "wg14-n1570"],
        "availability": "practice_ready",
        "completion_limit": "只比较指定输入的状态和输出；硬编码可满足固定条件，不能据此证明一般正确性、解释或独立迁移。",
        "code_request": starter,
        "reference_answer": answer,
        "prediction_prompt": "逐步预测分支或循环变量、输出及退出状态，并说明依据。",
        "reflection_prompt": "记录预测与真实结果的差异、修正原因、下一项边界条件；解释为何固定输出仍不能证明整体正确。",
        "hints": hints,
        "variants": [],
        "check_version": "cs01-fixed-condition-v1",
    }
    cases = [
        ("base", starter, expected[0], "not_met"),
        ("base", answer, expected[1], "met"),
    ]
    conditions = [("base", answer["stdin"], expected[1])]
    for name, label, instruction, initial, corrected, before, after in variants:
        activity["variants"].append(
            {
                "code": name,
                "title": label,
                "student_action": instruction,
                "code_request": initial,
                "prediction_prompt": activity["prediction_prompt"],
                "reflection_prompt": activity["reflection_prompt"],
            }
        )
        cases.extend(
            [
                (name, initial, before, "met" if before == after else "not_met"),
                (name, corrected, after, "met"),
            ]
        )
        conditions.append((name, corrected["stdin"], after))
    for name, stdin, output in conditions:
        rules.append([goal, name, stdin, "success", output, ""])
    for index, (name, req, output, decision) in enumerate(cases):
        fixtures.append(
            {
                "id": f"{goal}/{name}/{index}",
                "version": VERSION,
                "goal": goal,
                "activity": activity_id,
                "task": name,
                "request": req,
                "expected": {"status": "success", "stdout": output, "stderr": ""},
                "decision": decision,
            }
        )
    package["activities"].append(activity)
    objective = next(o for o in package["objectives"] if o["code"] == goal)
    objective["criteria"] = [
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


def labels(m, correct=False):
    body = f"int minutes = {m};\n"
    return request(
        body
        + (
            'if (minutes <= 30) puts("free");\nelse if (minutes <= 60) puts("paid");\nelse puts("full");'
            if correct
            else 'if (minutes <= 30) puts("free");\nif (minutes <= 60) puts("paid");'
        )
    )


def fee(m, low=30, high=60, correct=False):
    op = "<=" if correct else "<"
    return request(
        f'int minutes = {m}, amount;\nif (minutes {op} {low}) amount = 0;\nelse if (minutes {op} {high}) amount = 5;\nelse amount = 10;\nprintf("%d\\n", amount);'
    )


add(
    "CS01-M03-O01",
    "一次输入为何进入两条分支",
    "原创规则：0–30 分钟 free，31–60 paid，超过 60 full。输入 29，只允许输出 free 和换行；运行重叠条件后改成互斥分支。",
    [
        "独立的 if 会分别判断；if/else if 链只选择其中一支。先列表检查同一输入能否满足多个条件。"
    ],
    labels(29),
    labels(29, True),
    ("free\npaid\n", "free\n"),
    [
        (
            "above-all",
            "覆盖所有区间",
            "输入 61，要求 full；不能只处理前两段。",
            labels(61),
            labels(61, True),
            "",
            "full\n",
        )
    ],
    ["29 同时满足两个 <= 条件。", "用 else if 连接互斥选择，最后检查剩余区间。"],
)
add(
    "CS01-M03-O02",
    "实现包含端点的三段计费",
    "原创规则：0–30 分钟费用 0，31–60 费用 5，超过 60 费用 10。先预测 30 的输出，修复等值端点。",
    ["条件为真时执行对应分支；等号是否包含取决于业务规则，不能凭样例猜测。"],
    fee(30),
    fee(30, correct=True),
    ("5\n", "0\n"),
    [
        (
            "upper-equal",
            "第二个端点",
            "输入 60，费用应为 5。",
            fee(60),
            fee(60, correct=True),
            "10\n",
            "5\n",
        )
    ],
    ["把区间写成闭区间与剩余区间。", "单测 30 之后还需要单测 60。"],
)
boundary = []
for m in (29, 30, 31, 59, 61):
    want = "0\n" if m <= 30 else "5\n" if m <= 60 else "10\n"
    before = "0\n" if m < 30 else "5\n" if m < 60 else "10\n"
    boundary.append(
        (
            f"minutes-{m}",
            f"反例候选 {m}",
            f"输入 {m}，按 30/60 包含端点规则预测、运行并记录本次结果。",
            fee(m),
            fee(m, correct=True),
            before,
            want,
        )
    )
boundary.append(
    (
        "changed-policy",
        "收费规则改变",
        "新规则：0–45 费用 0，46–90 费用 5，超过 90 费用 10。输入 46，改写区间，不能沿用旧阈值。",
        fee(46, correct=True),
        fee(46, 45, 90, True),
        "5\n",
        "5\n",
    )
)
# Use 31 to expose stale rules under a narrower policy, rather than an unchanged output.
boundary[-1] = (
    "changed-policy",
    "收费规则改变",
    "新规则：0–20 费用 0，21–50 费用 5，超过 50 费用 10。输入 21，改写区间并解释哪些原测试应重做。",
    fee(21, correct=True),
    fee(21, 20, 50, True),
    "0\n",
    "5\n",
)
add(
    "CS01-M03-O03",
    "选择能揭示条件缺口的反例",
    "输入 60 应输出费用 5。再执行 29/30/31/59/61 的反例候选，比较哪些暴露错误；最后改变业务规则。",
    [
        "通过一个输入只能说明该输入未暴露问题。端点及两侧条件能帮助发现区间缺口，但不是对所有输入的证明。"
    ],
    fee(60),
    fee(60, correct=True),
    ("10\n", "5\n"),
    boundary,
    [
        "记录预期区间，不先看程序输出。",
        "比较等值点、左右邻点，以及业务规则改变后的旧假设。",
    ],
)


def trace(limit, correct=False):
    return request(
        f'int sum = 0;\nfor (int i = 1; i {"<=" if correct else "<"} {limit}; i++) {{\nsum += i;\nprintf("%d %d\\n", i, sum);\n}}'
    )


add(
    "CS01-M04-O01",
    "保留每一轮的变量轨迹",
    "要求循环覆盖 1、2、3，每轮输出 i 与累计值。先手算轨迹，再定位漏掉最后一轮的原因。",
    [
        "for 先检查继续条件，每轮执行循环体后更新变量，再检查条件。逐轮轨迹比只看最终值更容易定位边界错误。"
    ],
    trace(3),
    trace(3, True),
    ("1 1\n2 3\n", "1 1\n2 3\n3 6\n"),
    [
        (
            "empty-range",
            "循环体一次也不执行",
            "上界为 0，要求无输出；解释初始条件为何阻止进入。",
            trace(0),
            trace(0, True),
            "",
            "",
        )
    ],
    ["写出首次进入前的 i、sum。", "检查 i 为 3 时是否继续。"],
)


def countdown(n, correct=False):
    body = 'printf("%d\\n", n);\nn--;' if correct else 'n--;\nprintf("%d\\n", n);'
    return request(f"int n = {n};\nwhile (n > 0) {{\n{body}\n}}")


add(
    "CS01-M04-O02",
    "把进度变化与终止条件连起来",
    "从 3 倒数，要求输出 3、2、1；0 不输出。预测先减后输出的差异，再修复。另以零初值核对循环是否应该进入。",
    [
        "while 在执行循环体之前检查条件。每轮状态应向终止条件推进；输出和更新顺序也属于任务规则。"
    ],
    countdown(3),
    countdown(3, True),
    ("2\n1\n0\n", "3\n2\n1\n"),
    [
        (
            "zero-start",
            "初始状态已经终止",
            "n=0，要求无输出，解释为何不进入循环体。",
            countdown(0),
            countdown(0, True),
            "",
            "",
        )
    ],
    ["先写期望第一行，再安排状态更新。", "比较 n>0 在循环体前后分别检查的意义。"],
)
loop_activity = package["activities"][-1]
loop_activity["variants"].append(
    {
        "code": "missing-termination",
        "title": "修复无法终止的循环",
        "student_action": "初始循环没有退出条件。只在受限沙箱运行一次观察超时，然后改成从 3 输出 3、2、1 并结束的程序；解释状态为何必然推进。",
        "code_request": request("while (1) {}"),
        "prediction_prompt": "这个循环何时退出？预测工具会怎样处理。",
        "reflection_prompt": "超时不是正确结果；写出退出条件与每轮状态推进。",
    }
)
rules.append(["CS01-M04-O02", "missing-termination", "", "success", "3\n2\n1\n", ""])
for suffix, req, status, output, decision in [
    ("initial", request("while (1) {}"), "timeout", "", "not_met"),
    ("repaired", countdown(3, True), "success", "3\n2\n1\n", "met"),
]:
    fixtures.append(
        {
            "id": "CS01-M04-O02/missing-termination/" + suffix,
            "version": VERSION,
            "goal": "CS01-M04-O02",
            "activity": loop_activity["version_id"],
            "task": "missing-termination",
            "request": req,
            "expected": {
                "status": status,
                "stdout": "" if status == "timeout" else output,
            },
            "decision": decision,
        }
    )


def stream(stdin, correct=False):
    return request(
        "int ch, sum = 0, count = 0;\nwhile ((ch = getchar()) != EOF && ch != '#') {\nint delta = 0;\nif (ch == '+') delta = 1;\nelse if (ch == '-') delta = -1;\n"
        + ("sum += delta;" if correct else "sum = delta;")
        + '\ncount++;\nprintf("step=%d sum=%d\\n", count, sum);\n}\nprintf("sum=%d count=%d\\n", sum, count);',
        stdin,
    )


add(
    "CS01-M04-O03",
    "累计值必须代表已处理的整个前缀",
    "字符协议：+ 表示 1，- 表示 -1，0 表示 0，# 或 EOF 结束，# 后内容不处理。仅测试这些合法字符。输入 -0+#，每轮保存累计值；解释覆盖赋值与累加的区别。",
    [
        "这里的不变量是 sum 等于已处理前缀的值之和，count 等于已处理字符数。这是任务定义，应逐轮验证初始化、保持和退出时的含义。"
    ],
    stream("-0+#"),
    stream("-0+#", True),
    (
        "step=1 sum=-1\nstep=2 sum=0\nstep=3 sum=1\nsum=1 count=3\n",
        "step=1 sum=-1\nstep=2 sum=-1\nstep=3 sum=0\nsum=0 count=3\n",
    ),
    [
        (
            "end-only",
            "只有结束标记",
            "输入 #，应为 sum=0 count=0。",
            stream("#"),
            stream("#", True),
            "sum=0 count=0\n",
            "sum=0 count=0\n",
        ),
        (
            "empty-input",
            "EOF 空输入",
            "没有字符，循环体不进入。",
            stream(""),
            stream("", True),
            "sum=0 count=0\n",
            "sum=0 count=0\n",
        ),
        (
            "ignore-after-end",
            "结束后不再累计",
            "输入 -#+，+ 不应被处理。",
            stream("-#+"),
            stream("-#+", True),
            "step=1 sum=-1\nsum=-1 count=1\n",
            "step=1 sum=-1\nsum=-1 count=1\n",
        ),
    ],
    ["比较第一轮和第二轮的 sum。", "累计要使用上一轮值；# 的判断应在处理之前。"],
)
package["sources"].append(
    {
        "id": "wg14-n1570-control",
        "title": "WG14 N1570：控制语句（C11 委员会草案）",
        "url": "https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf",
        "locator": "6.8.4.1；6.8.5.1；6.8.5.3；非 C17 正式标准",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)
for relative, value in [
    ("content/courses/CS01/CS01-core-practice-0.4.0/manifest.json", package),
    ("services/backend/fixtures/course-code/CS01-control.json", fixtures),
    ("services/backend/fixtures/course-code/CS01-control-rules.json", rules),
]:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
