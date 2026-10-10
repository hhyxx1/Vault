"""Author bounded array, string and ownership activities; no undefined-output oracle."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
VERSION = str(uuid5(NAMESPACE_URL, "vault:CS01-core-practice-0.6.0"))
package = json.loads(
    (ROOT / "content/courses/CS01/CS01-core-practice-0.5.0/manifest.json").read_text(
        encoding="utf-8"
    )
)
package.update(
    course_version_id=VERSION,
    version="CS01-core-practice-0.6.0",
    scope_note="30 个目标保留完整分母；前七模块二十一项受限实践提供固定条件核验。内存安全、解释和独立迁移不能由输出比较证明；整课验收继续建设。",
)
fixtures, rules = [], []


def request(body, functions=""):
    return {
        "language": "c17",
        "entry": "main.c",
        "files": {
            "main.c": "#include <stdio.h>\n#include <stdlib.h>\n"
            + functions
            + "\nint main(void) {\n"
            + body
            + "\nreturn 0;\n}\n"
        },
        "stdin": "",
    }


def add(goal, title, action, theory, hints, cases):
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
        "starter": "先标注有效长度、容量或所有权，预测后再运行。",
        "source_refs": ["wg14-n1570-memory"],
        "availability": "practice_ready",
        "completion_limit": "比较固定条件下真实输出，不证明一般内存安全、没有泄漏或解释正确。未定义行为不得用本机输出判为正确；解释与独立迁移待复核。",
        "code_request": cases[0][3],
        "reference_answer": cases[0][4],
        "prediction_prompt": "写出每一步有效元素、终止符或指针所指对象；标明允许访问范围。",
        "reflection_prompt": "比较预测与结果，解释修正和未证明的安全条件；下一次如何测试边界或故障？",
        "hints": hints,
        "variants": [],
        "check_version": "cs01-fixed-condition-v1",
    }
    for task, label, instruction, initial, repaired, before, after in cases:
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
        for label, req, output in [
            ("initial", initial, before),
            ("repaired", repaired, after),
        ]:
            fixtures.append(
                {
                    "id": goal + "/" + task + "/" + label,
                    "version": VERSION,
                    "goal": goal,
                    "activity": identity,
                    "task": task,
                    "request": req,
                    "stdout": output,
                    "decision": "met" if output == after else "not_met",
                }
            )
    package["activities"].append(activity)
    next(o for o in package["objectives"] if o["code"] == goal)["criteria"] = [
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


def traversal(n, correct=False):
    return request(
        f'int values[3]={{1,2,3}}; int length={n};\nfor(int i={0 if correct else 1};i<length;i++) values[i]*=2;\nfor(int i=0;i<length;i++) printf("%d%s",values[i],i+1==length?"\\n":" ");'
    )


add(
    "CS01-M06-O01",
    "遍历要覆盖第一个有效元素",
    "有效数组 [1,2,3] 的每项乘二，要求 2 4 6；先标下标与长度，再定位漏掉首项。空长度不输出，单元素也必须更新。",
    [
        "有效长度与数组容量分开记录；本任务只访问 0 至 length-1，修改下标应覆盖全部有效元素。"
    ],
    ["检查循环初值是否跳过下标 0。", "用 length=0 和 length=1 检查首次判断。"],
    [
        (
            "base",
            "全元素更新",
            "更新三项",
            traversal(3),
            traversal(3, True),
            "1 4 6\n",
            "2 4 6\n",
        ),
        (
            "empty-length",
            "没有有效元素",
            "length=0，无输出，不能读第一项来充数。",
            traversal(0),
            traversal(0, True),
            "",
            "",
        ),
        (
            "single-item",
            "只有一个有效元素",
            "length=1，应输出 2。",
            traversal(1),
            traversal(1, True),
            "1\n",
            "2\n",
        ),
    ],
)


def string_case(text, capacity, correct=False):
    chars = ",".join(repr(c) for c in text)
    init = f"char source[{max(1, len(text))}]={{{chars if chars else '0'}}};"
    return request(
        init
        + f"\nchar buffer[{capacity}]; int length={len(text)};\nfor(int i=0;i<{capacity};i++) buffer[i]='?';\nfor(int i=0;i<length;i++) buffer[i]=source[i];\n"
        + ("buffer[length]='\\0';\n" if correct else "")
        + f'int end=0; while(end<{capacity} && buffer[end]!=\'\\0\') end++;\nif(end=={capacity}) puts("unterminated"); else printf("length=%d text=%s\\n",end,buffer);'
    )


add(
    "CS01-M06-O02",
    "内容之外还要留终止符",
    "将含空格的 a b 放入容量 4 的缓冲区。初始工件有界扫描，未终止时只报告 unterminated，不对非字符串调用 %s；修复后输出 length=3 text=a b。",
    ["字符内容和结尾空字符占用不同位置；先确认终止符位于容量内，再按字符串输出。"],
    ["标出三个字符之后的一个位置。", "不要用无界输出观察缺终止符的数组。"],
    [
        (
            "base",
            "空格是内容",
            "a b",
            string_case("a b", 4),
            string_case("a b", 4, True),
            "unterminated\n",
            "length=3 text=a b\n",
        ),
        (
            "exact-fit",
            "内容加终止符恰好装满",
            "abcd 放入容量 5，最后一格留空字符。",
            string_case("abcd", 5),
            string_case("abcd", 5, True),
            "unterminated\n",
            "length=4 text=abcd\n",
        ),
        (
            "empty-text",
            "空串仍需终止符",
            "容量 1，空串应 length=0。",
            string_case("", 1),
            string_case("", 1, True),
            "unterminated\n",
            "length=0 text=\n",
        ),
    ],
)


def insertion(pos, full=False, correct=False):
    length = 4 if full else 3
    shift = (
        "for(int i=length;i>position;i--) values[i]=values[i-1];"
        if correct
        else "for(int i=position+1;i<=length;i++) values[i]=values[i-1];"
    )
    return request(
        f'int values[4]={{2,4,6,8}}; int length={length}, position={pos};\nif(length==4) puts("full"); else if(position<0 || position>length) puts("invalid"); else {{\n{shift}\nvalues[position]=9; length++;\n}}\nfor(int i=0;i<length;i++) printf("%d%s",values[i],i+1==length?"\\n":" ");'
    )


add(
    "CS01-M06-O03",
    "移动元素时保护原数据与容量",
    "容量 4，有效 [2,4,6]，在位置 0 插入 9，期望 9 2 4 6。初始向右顺序错误会重复原值，先画移动轨迹再修复；禁止访问容量外。",
    [
        "插入前检查容量和位置；从尾部移动可以避免覆盖尚未复制的元素。固定结果不证明任意容量实现安全。"
    ],
    ["画出第一次移动后下一次读到的值。", "先检查空位，再从末尾向插入位置移动。"],
    [
        (
            "base",
            "首位插入",
            "位置 0",
            insertion(0),
            insertion(0, correct=True),
            "9 2 2 2\n",
            "9 2 4 6\n",
        ),
        (
            "tail-insert",
            "尾位无需搬移",
            "position=length，追加 9。",
            insertion(3),
            insertion(3, correct=True),
            "2 4 6 9\n",
            "2 4 6 9\n",
        ),
        (
            "full-capacity",
            "满容量保留原值",
            "已有四项，拒绝插入并打印原数组。",
            insertion(0, True),
            insertion(0, True, True),
            "full\n2 4 6 8\n",
            "full\n2 4 6 8\n",
        ),
        (
            "invalid-position",
            "非法位置被拒绝",
            "position=-1，不得访问负下标。",
            insertion(-1),
            insertion(-1, correct=True),
            "invalid\n2 4 6\n",
            "invalid\n2 4 6\n",
        ),
    ],
)


def alias(distinct=False, correct=False):
    return request(
        "int original=5, other=7, replacement=9;\nint *p=&original; int *q="
        + ("&other;" if distinct else "&original;")
        + "\n"
        + ("*p=9;" if correct else "p=&replacement;")
        + '\nprintf("original=%d p=%d q=%d\\n",original,*p,*q);'
    )


add(
    "CS01-M07-O01",
    "改指针还是改指针所指对象",
    "p、q 起初指向 original=5；任务要求原对象更新为 9，两处别名读到同一值。初始工件只改 p 的绑定；不要依赖地址数值。",
    [
        "指针赋值改变所指对象，解引用赋值改变被指向的值；别名是否同步取决于是否指向同一个对象。"
    ],
    ["分别标出 p 与 q 所指对象。", "比较 p=... 和 *p=... 的修改位置。"],
    [
        (
            "base",
            "相同对象",
            "两个别名",
            alias(),
            alias(correct=True),
            "original=5 p=9 q=5\n",
            "original=9 p=9 q=9\n",
        ),
        (
            "distinct-object",
            "名字相似不代表别名",
            "q 指向 other=7；更新 original 后 q 仍读 7。",
            alias(True),
            alias(True, True),
            "original=5 p=9 q=7\n",
            "original=9 p=9 q=7\n",
        ),
    ],
)


def grow(fail=False, correct=False):
    body = "int *owner=malloc(2*sizeof *owner); if(!owner) return 1;\nowner[0]=2;owner[1]=4;\n"
    if fail:
        body += (
            "int *next=NULL; /* injected failure: do not call realloc */\nif(!next) {\n"
            + ('puts("retained");' if correct else 'puts("discarded");')
            + '\nprintf("%d %d\\n",owner[0],owner[1]);\nfree(owner); owner=NULL;\n}'
        )
    else:
        body += (
            "int *next=realloc(owner,4*sizeof *owner); if(!next) {free(owner);return 1;}\nowner=next; owner[2]=0; owner[3]=0;\nfor(int i=2;i<"
            + ("4" if correct else "3")
            + ';i++) owner[i]=2*(i+1);\nprintf("%d %d %d %d\\n",owner[0],owner[1],owner[2],owner[3]);\nfree(owner);owner=NULL;'
        )
    return request(body)


add(
    "CS01-M07-O02",
    "扩容成功与失败走不同所有权路径",
    "实际分配两项 [2,4] 并扩容到四项，要求旧项保留、新项为 6、8；新区域先初始化为 0 后展示漏更新问题。另用显式故障注入保留原块，不能声称实测了系统耗尽。",
    [
        "非零扩容失败时旧块仍保留；成功后使用返回的新指针。新增区域需要明确初始化，每条分支都需核对释放责任。"
    ],
    ["列出成功和失败分支各自的 owner。", "核对新增两项都被设置，最后由哪条路径释放。"],
    [
        (
            "base",
            "真实扩容",
            "扩容到四项",
            grow(),
            grow(correct=True),
            "2 4 6 0\n",
            "2 4 6 8\n",
        ),
        (
            "injected-failure",
            "注入失败保留旧块",
            "next=NULL 为明确故障注入；报告 retained，打印 2 4，释放原块。",
            grow(True),
            grow(True, True),
            "discarded\n2 4\n",
            "retained\n2 4\n",
        ),
    ],
)


def release(correct=False, value=7):
    return request(
        f"int *owner=malloc(sizeof *owner); if(!owner) return 1; *owner={value};\nint *alias=owner; int saved=*alias; int alive=1;\nalias=NULL; free(owner); owner=NULL;\n"
        + ("alive=0;\n" if correct else "")
        + 'puts(alive?"claim-alive":"released");\nprintf("saved=%d\\n",saved);'
    )


add(
    "CS01-M07-O03",
    "释放后保留值副本而非悬空访问",
    "保存值副本后清除别名并释放唯一所有者；初始元数据仍声称对象存活。修复状态报告，输出 released 与 saved=7。不得解引用或比较已失效指针，不以无崩溃证明安全。",
    [
        "本任务在释放前复制值并清除别名；释放后的元数据不能授予旧对象访问权限。状态报告是学习模型，不是通用内存诊断器。"
    ],
    [
        "核对释放时 alive 是否更新。",
        "saved 是值副本，不是别名；列出所有仍持有引用的位置。",
    ],
    [
        (
            "base",
            "已释放与值副本",
            "保存 7",
            release(),
            release(True),
            "claim-alive\nsaved=7\n",
            "released\nsaved=7\n",
        ),
        (
            "zero-copy",
            "零值也是合法副本",
            "值为 0，不能把值为零误认为对象不存在。",
            release(value=0),
            release(True, 0),
            "claim-alive\nsaved=0\n",
            "released\nsaved=0\n",
        ),
    ],
)
package["sources"].append(
    {
        "id": "wg14-n1570-memory",
        "title": "WG14 N1570：数组、字符串和分配（C11 委员会草案）",
        "url": "https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf",
        "locator": "6.2.5；6.5.2.1；7.1.1；7.22.3.3–7.22.3.5；非 C17 正式标准",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)
for name, value in [
    ("content/courses/CS01/CS01-core-practice-0.6.0/manifest.json", package),
    ("services/backend/fixtures/course-code/CS01-memory.json", fixtures),
    ("services/backend/fixtures/course-code/CS01-memory-rules.json", rules),
]:
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
print(VERSION, len(fixtures))
