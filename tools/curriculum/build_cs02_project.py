"""Original Java21 borrowing project with file snapshot recovery."""

import copy
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS02-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS02-M08-O03"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))
REFERENCE = (ROOT / "tools/curriculum/assets/Library.java").read_text(encoding="utf-8")
GUARD = 'if (!loan.owner().equals(owner)) throw new IllegalArgumentException("owner required");'
INITIAL = REFERENCE.replace(GUARD, "// missing ownership guard", 1)
assert REFERENCE != INITIAL
MAIN = """import java.nio.file.*;
import java.util.Scanner;
public class Main {
 public static void main(String[] args) throws Exception {
  int scenario=new Scanner(System.in).nextInt();
  Library library=new Library();library.addBook("B1","Algorithms",scenario==1?1:2);
  long first=library.borrow("B1","alice");
  long second=scenario==1?0:library.borrow("B1","bob");
  System.out.println("available="+library.available("B1"));
  try{library.borrow("B1","charlie");System.out.println("stock violated");}
  catch(IllegalStateException e){System.out.println("no stock");}
  Path file=Path.of("library.tsv");library.save(file);Library restored=Library.load(file);
  System.out.println("restored="+restored.available("B1"));
  try{restored.giveBack(first,"bob");System.out.println("other owner accepted");}
  catch(IllegalArgumentException e){System.out.println("other owner rejected");}
  try{restored.giveBack(first,"alice");System.out.println("returned");}
  catch(IllegalArgumentException|IllegalStateException e){System.out.println("return failed");}
  if(second!=0)restored.giveBack(second,"bob");
  try{restored.giveBack(first,"alice");System.out.println("duplicate accepted");}
  catch(IllegalArgumentException|IllegalStateException e){System.out.println("repeat rejected");}
  restored.save(file);Library reopened=Library.load(file);
  System.out.println("reopened="+reopened.available("B1"));
  System.out.println("monotonic ID="+(reopened.borrow("B1","charlie")>Math.max(first,second)));
 }
}
"""


def build():
    package = json.loads(
        (
            ROOT / "content/courses/CS02/CS02-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="24目标局部Java实践，新增借阅库存、对象权限、异常、不可变记录与真实文件保存重载综合项目；完整课程深度仍缺。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    activity["theory"] += [
        "综合借阅使用私有TreeMap、不可变record，库存从活跃借阅计算；归还校验所属人和状态。UTF8版本化文本保存，临时文件原子替换，重新创建Library对象后实际载入。",
        "这是单用户进程内教学领域库，不提供网络登录、并发写入、崩溃断电耐久或跨沙箱文件保留。旧对象不得替代文件恢复；空对象重新load后校验库存和ID。",
    ]
    package["sources"] += [
        {
            "id": "java21-records",
            "title": "Java21 Record Classes",
            "url": "https://docs.oracle.com/en/java/javase/21/language/records.html",
            "locator": "final components; original library uses only immutable primitive/String components",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        },
        {
            "id": "java21-library-files",
            "title": "Java21 Files and atomic move",
            "url": "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/Files.html",
            "locator": "UTF8 read/write and ATOMIC_MOVE; not guaranteed cross-filesystem or crash durability",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        },
    ]
    activity["source_refs"] = sorted(
        set(activity["source_refs"] + ["java21-records", "java21-library-files"])
    )
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS02-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
        if row["goal"] == GOAL:
            row["activity"] = ACTIVITY
    for task, scenario in [("library-owner", 1), ("library-two-borrowers", 2)]:
        first = {
            "language": "java21",
            "entry": "Main.java",
            "files": {"Main.java": MAIN, "Library.java": INITIAL},
            "stdin": str(scenario) + "\n",
        }
        fixed = {**first, "files": {"Main.java": MAIN, "Library.java": REFERENCE}}
        expected = f"available=0\nno stock\nrestored=0\nother owner rejected\nreturned\nrepeat rejected\nreopened={scenario}\nmonotonic ID=true\n"
        wrong = expected.replace(
            "other owner rejected\nreturned", "other owner accepted\nreturn failed"
        )
        activity["variants"].append(
            {
                "code": task,
                "title": "借阅综合项目："
                + ("所属人规则与文件恢复" if scenario == 1 else "两个借阅者与库存恢复"),
                "student_action": "预测库存、错误归还和重载结果；实际编译运行并修改Library.java，再对照两借阅者的状态。",
                "code_request": first,
                "reference_answer": fixed,
                "prediction_prompt": "借阅耗尽后、错误归还后和创建新对象读取文件后，哪些不变量应保持？",
                "reflection_prompt": "解释封装、不可变记录和异常约束；用真实文件重载工件说明恢复，注明并发和崩溃仍未验证。",
            }
        )
        for label, request, output in [
            ("initial", first, wrong),
            ("repaired", fixed, expected),
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
                    "decision": "met" if label == "repaired" else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS02/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS02-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
