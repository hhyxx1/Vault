"""Struct records and independently replaceable display modules."""

from pathlib import Path

from code_authoring import CodeBook

book = CodeBook(
    Path(__file__).resolve().parents[2],
    "CS01-core-practice-0.6.0",
    "CS01-core-practice-0.7.0",
    "30 个目标保留完整分母；前八模块二十四项受限实践提供固定条件核验。文件恢复、整课综合任务、解释及独立迁移仍在建设。",
)
SOURCE = ["wg14-n1570-records"]


def request(files):
    return {"language": "c17", "entry": "main.c", "files": files, "stdin": ""}


def structure(first=80, second=70, correct=False):
    return request(
        {
            "main.c": "#include <stdio.h>\nstruct Record { int id; int score; };\nint main(void) {\n"
            + f"struct Record records[2]={{{{7,{first}}},{{8,{second}}}}};\n"
            + (
                "int total=records[0].score+records[1].score;"
                if correct
                else "int total=records[0].score+records[0].score;"
            )
            + '\nprintf("first=%d second=%d total=%d\\n",records[0].id,records[1].id,total);\nreturn 0;\n}\n'
        }
    )


book.add(
    "CS01-M08-O01",
    "每条复合记录都有自己的字段",
    "学号 7/8 的分数为 80/70，总分应为 150。初始作品误重复第一条，先画记录与字段再修复。",
    [
        "结构体按成员组合不同数据；访问某一成员仍需要明确属于哪条记录。这里只比较值，不承诺对象布局或序列化字节。"
    ],
    ["把 records[0] 和 records[1] 分开标注。", "核对总分的两个来源。"],
    SOURCE,
    [
        (
            "base",
            "两条记录",
            "总分 150",
            structure(),
            structure(correct=True),
            "first=7 second=8 total=160\n",
            "first=7 second=8 total=150\n",
        ),
        (
            "zero-score",
            "零分记录不能丢失",
            "第一条为 0，第二条为 90，总分 90。",
            structure(0, 90),
            structure(0, 90, True),
            "first=7 second=8 total=0\n",
            "first=7 second=8 total=90\n",
        ),
    ],
)


def modules(correct=False, alternative=False):
    header = "#ifndef RECORD_H\n#define RECORD_H\nstruct Record {int id; int score;};\nstruct Record make_record(int id, int score);\nvoid display_record(const struct Record *record);\n#endif\n"
    implementation = (
        '#include "record.h"\nstruct Record make_record(int id,int score) { struct Record result={'
        + ("id,score" if correct else "1,0")
        + "}; return result; }\n"
    )
    display = (
        '#include <stdio.h>\n#include "record.h"\nvoid display_record(const struct Record *record) { printf("'
        + ("id=%d;score=%d" if alternative else "student=%d score=%d")
        + '\\n",record->id,record->score); }\n'
    )
    main = '#include "record.h"\nint main(void) {struct Record record=make_record(7,80);display_record(&record);return 0;}\n'
    return request(
        {
            "main.c": main,
            "record.h": header,
            "record.c": implementation,
            "display.c": display,
        }
    )


book.add(
    "CS01-M08-O02",
    "头文件约定与多文件实现一致",
    "main.c、record.h、record.c、display.c 共同构建。构造器必须使用传入学号和分数，显示模块只读。初始构造器丢弃参数，修复 record.c 后重新构建。",
    [
        "头文件声明接口，各实现文件分别包含它；显示与存储责任分开。本任务实际编译所有 C 实现，不是把文本拼接成单文件演示。"
    ],
    [
        "在编辑文件中选择 record.c，追踪参数。",
        "独立改变 display.c 时，记录值不应改变。",
    ],
    SOURCE,
    [
        (
            "base",
            "跨文件参数",
            "student=7 score=80",
            modules(),
            modules(True),
            "student=1 score=0\n",
            "student=7 score=80\n",
        ),
        (
            "replace-display",
            "只替换显示模块",
            "构造器已修正，仅修改 display.c 为 id=7;score=80 格式；保留其他三个文件。",
            modules(True),
            modules(True, True),
            "student=7 score=80\n",
            "id=7;score=80\n",
        ),
    ],
)


def constrained(value, correct=False):
    body = (
        "if(value<0 || value>100) return 0; record->score=value; return 1;"
        if correct
        else "record->score=value; if(value<0 || value>100) return 0; return 1;"
    )
    return request(
        {
            "main.c": "#include <stdio.h>\nstruct Record {int id; int score;};\nint set_score(struct Record *record,int value) {"
            + body
            + "}\nint main(void) {struct Record record={7,80};\n"
            + f"int accepted=set_score(&record,{value});\n"
            + 'printf("accepted=%d id=%d score=%d\\n",accepted,record.id,record.score);return 0;}\n'
        }
    )


cases = []
for task, title, value in [
    ("base", "拒绝超上限", 101),
    ("negative-score", "负值拒绝", -1),
    ("lower-equal", "下限允许", 0),
    ("upper-equal", "上限允许", 100),
]:
    accepted = int(0 <= value <= 100)
    after = f"accepted={accepted} id=7 score={value if accepted else 80}\n"
    cases.append(
        (
            task,
            title,
            f"分数范围 0–100；输入 {value}，拒绝时保持原学号和原分数。",
            constrained(value),
            constrained(value, True),
            f"accepted={accepted} id=7 score={value}\n",
            after,
        )
    )
book.add(
    "CS01-M08-O03",
    "拒绝更新时对象也必须保持有效",
    "分数只允许 0–100。输入 101 必须拒绝并保留 score=80；初始程序先写后检查，返回拒绝却破坏对象。先写对象约束，再安排检查顺序。",
    [
        "对象约束是任务定义；返回错误状态不等于数据未改变。修改前检查和失败后状态都应有实际证据。"
    ],
    ["标出首次写入字段的位置。", "拒绝分支应发生在修改之前。"],
    SOURCE,
    cases,
)
book.package["sources"].append(
    {
        "id": "wg14-n1570-records",
        "title": "WG14 N1570：结构成员与头文件（C11 委员会草案）",
        "url": "https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf",
        "locator": "6.5.2.3；6.7.2.1；6.10.2；非 C17 正式标准",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)
book.save("CS01-records")
