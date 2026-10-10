"""Original bounded combination; fixed outputs authored before sandbox execution."""

import copy
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS01-core-practice-0.9.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS01-M10-O03"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))

SOURCE = r"""#include <stdio.h>
#include <string.h>
typedef struct { int cents; } Ledger;
static int add(Ledger *book, int delta) {
    if (delta < -10000 || delta > 10000) return 0;
    int candidate = book->cents + delta;
    book->cents = candidate; /* BUG: rejected withdrawal changes the ledger */
    if (candidate < 0 || candidate > 10000) return 0;
    return 1;
}
static int save(const Ledger *book) {
    FILE *f = fopen("/box/tmp/ledger.txt", "w");
    if (!f) return 0;
    int written = fprintf(f, "%d\n", book->cents) > 0;
    int closed = fclose(f) == 0;
    return written && closed;
}
static int load(Ledger *book) {
    FILE *f = fopen("/box/tmp/ledger.txt", "r");
    if (!f) return 0;
    int candidate = 0;
    int parsed = fscanf(f, "%d", &candidate) == 1;
    int closed = fclose(f) == 0;
    if (!parsed || !closed || candidate < 0 || candidate > 10000) return 0;
    book->cents = candidate;
    return 1;
}
int main(void) {
    Ledger book = {0};
    char command[16];
    while (scanf("%15s", command) == 1) {
        if (strcmp(command, "add") == 0) {
            int delta;
            if (scanf("%d", &delta) != 1) return 2;
            int ok = add(&book, delta);
            printf("%s balance=%d\n", ok ? "accepted" : "rejected", book.cents);
        } else if (strcmp(command, "save") == 0) {
            puts(save(&book) ? "saved" : "save-failed");
        } else if (strcmp(command, "reset") == 0) {
            book.cents = 0;
            puts("memory-reset");
        } else if (strcmp(command, "load") == 0) {
            int ok = load(&book);
            printf("%s balance=%d\n", ok ? "loaded" : "load-failed", book.cents);
        } else if (strcmp(command, "show") == 0) {
            printf("balance=%d\n", book.cents);
        } else return 3;
    }
    return 0;
}
"""
FIXED = SOURCE.replace(
    "    book->cents = candidate; /* BUG: rejected withdrawal changes the ledger */\n"
    "    if (candidate < 0 || candidate > 10000) return 0;",
    "    if (candidate < 0 || candidate > 10000) return 0;\n    book->cents = candidate;",
)
CASES = [
    (
        "ledger-recovery",
        "组合实践：拒绝透支后保存并恢复",
        "add 1250\nadd -250\nadd -2000\nsave\nreset\nload\nshow\n",
        "accepted balance=1250\naccepted balance=1000\nrejected balance=-1000\nsaved\nmemory-reset\nload-failed balance=0\nbalance=0\n",
        "accepted balance=1250\naccepted balance=1000\nrejected balance=1000\nsaved\nmemory-reset\nloaded balance=1000\nbalance=1000\n",
    ),
    (
        "ledger-empty",
        "组合新条件：空账本与不存在的记录",
        "load\nadd -1\nsave\nreset\nload\n",
        "load-failed balance=0\nrejected balance=-1\nsaved\nmemory-reset\nload-failed balance=0\n",
        "load-failed balance=0\nrejected balance=0\nsaved\nmemory-reset\nloaded balance=0\n",
    ),
    (
        "ledger-boundary",
        "组合新条件：容量上界与零余额",
        "add 10000\nadd 1\nadd -10000\nsave\nreset\nload\n",
        "accepted balance=10000\nrejected balance=10001\naccepted balance=1\nsaved\nmemory-reset\nloaded balance=1\n",
        "accepted balance=10000\nrejected balance=10000\naccepted balance=0\nsaved\nmemory-reset\nloaded balance=0\n",
    ),
]


def build():
    package = json.loads(
        (
            ROOT / "content/courses/CS01/CS01-core-practice-0.8.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(course_version_id=VERSION, version=NAME)
    package["scope_note"] = (
        "30 个目标有受限实践；新增命令行收支组合变体，在同一作业内清空内存后从真实文件恢复。跨作业文件恢复、解释、独立迁移及整课验收未完成。"
    )
    for relation in package["relations"]:
        if relation.get("course_version_id"):
            relation["course_version_id"] = VERSION
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    file_activity = next(
        a for a in package["activities"] if a["code"] == "CS01-M09-O01-CODE"
    )
    activity["source_refs"] = list(
        dict.fromkeys(activity["source_refs"] + file_activity["source_refs"])
    )
    activity["theory"].append(
        "组合账本以整数分保存金额；拒绝交易必须保留原状态。实际文件关闭成功与重新读取成功分别检查。reset 仅清空本次进程内状态，文件不跨隔离作业保留。"
    )
    activity["hints"].append(
        "组合账本：先比较 candidate 是否满足余额范围，再更新 cents；检查拒绝后保存的是否仍为有效余额。"
    )
    rows = []
    for code, title, stdin, before, after in CASES:
        initial = {
            "language": "c17",
            "entry": "main.c",
            "files": {"main.c": SOURCE},
            "stdin": stdin,
        }
        answer = copy.deepcopy(initial)
        answer["files"]["main.c"] = FIXED
        activity["variants"].append(
            {
                "code": code,
                "title": title,
                "student_action": "先预测每条命令及最后余额，定位拒绝后的状态污染，修改并复跑。说明为何正常结束不代表账本正确。金额以整数分计，范围 0..10000。只使用本任务给定的有界输入；文件不跨执行保留。reset 仅模拟丢失内存状态，不是进程或平台重启。",
                "code_request": initial,
                "reference_answer": answer,
                "prediction_prompt": "预测透支或超上界拒绝后的余额、保存内容及重新加载结果；列明不变量。",
                "reflection_prompt": "比较失败、修正及文件恢复证据；说明这次运行未验证哪些课程目标和哪些故障。",
            }
        )
        for label, request, output in [
            ("initial", initial, before),
            ("repaired", answer, after),
        ]:
            rows.append(
                {
                    "id": code + "/" + label,
                    "version": VERSION,
                    "goal": GOAL,
                    "activity": ACTIVITY,
                    "task": code,
                    "request": request,
                    "stdout": output,
                    "decision": "met" if output == after else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS01/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS01-ledger.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, ACTIVITY)


if __name__ == "__main__":
    build()
