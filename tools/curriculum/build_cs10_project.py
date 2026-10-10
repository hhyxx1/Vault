"""Original two-increment submission service teaching project."""

import copy
import importlib.util
import json
import tempfile
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS10-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS10-M09-O03"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))
REFERENCE = (ROOT / "tools/curriculum/assets/submission_service.py").read_text(
    encoding="utf-8"
)
INITIAL = REFERENCE.replace(
    "if identity != row[0]:", "if False:  # missing ownership policy", 1
)
assert INITIAL != REFERENCE
MAIN = """import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('service','service.py')
service=importlib.util.module_from_spec(spec);spec.loader.exec_module(service)
title=sys.stdin.read().strip()
print(json.dumps(service.exercise(title),sort_keys=True))
"""


def build():
    spec = importlib.util.spec_from_file_location(
        "author_service", ROOT / "tools/curriculum/assets/submission_service.py"
    )
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    package = json.loads(
        (
            ROOT / "content/courses/CS10/CS10-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="27目标局部实践，新增真实HTTP/SQLite提交服务两增量、重复提交与重启恢复实验；完整需求架构评审及课程深度仍缺。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    activity["theory"] += [
        "本项目在单次私有沙箱内启动、关闭并重新启动HTTP服务。增量1创建/读取持久化草稿，增量2增加提交与同key重放，SQLite事务保留状态和事件。是本地教学发布演练，不是公网生产上线。",
        "X-Lab-Identity仅模拟已确认身份，不是认证；任何人能伪造此头，不能用于实际产品安全。修复所属人判断，区分401/403/404/409，检查重启恢复与审计只追加一次。",
    ]
    activity["source_refs"] = sorted(
        set(activity["source_refs"] + ["se-http", "se-sqlite", "se-authorization"])
    )
    package["sources"] += [
        {
            "id": "se-sqlite",
            "title": "Python sqlite3 transactions and placeholders",
            "url": "https://docs.python.org/3.13/library/sqlite3.html",
            "locator": "parameter binding, transaction control, explicit connection close; original lesson service",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        },
        {
            "id": "se-authorization",
            "title": "OWASP Authorization Cheat Sheet",
            "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
            "locator": "authorization on every request and ownership; identity is only simulated here",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        },
    ]
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS10-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
        if row["goal"] == GOAL:
            row["activity"] = ACTIVITY
    for task, title in [
        ("service-owner", "Graph proof"),
        ("service-replay", "Search report"),
    ]:
        with tempfile.TemporaryDirectory() as directory:
            actual = reference.exercise(title, Path(directory) / "course.db")
        assert actual["other_owner_status"] == 403 and actual["repeated_identical"]
        assert actual["audit"] == ["created", "submitted"]
        bad = copy.deepcopy(actual)
        if task == "service-owner":
            starter = INITIAL
            bad["other_owner_status"] = 200
        else:
            starter = REFERENCE.replace(
                "        if prior:\n",
                '        if prior:\n            db.execute("INSERT INTO events(draft,action) VALUES(?,?)", (draft, "submitted"))  # erroneous repeated side effect\n',
                1,
            )
            assert starter != REFERENCE
            bad["audit"] = ["created", "submitted", "submitted"]
        first = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": MAIN, "service.py": starter},
            "stdin": title + "\n",
        }
        fixed = {**first, "files": {"main.py": MAIN, "service.py": REFERENCE}}
        activity["variants"].append(
            {
                "code": task,
                "title": "提交服务综合项目：" + title,
                "student_action": "预测所属人访问、增量、重复提交和重启结果；执行HTTP场景，修改service.py再核对状态与审计。",
                "code_request": first,
                "reference_answer": fixed,
                "prediction_prompt": "增量1哪些接口不存在？另一身份读草稿应怎样？重复提交与重启各应保留什么？",
                "reflection_prompt": "写出反例对应的需求、修复和验收；说明模拟身份的安全边界以及未完成的架构/真实发布验证。",
            }
        )
        for label, request, result in [
            ("initial", first, bad),
            ("repaired", fixed, actual),
        ]:
            rows.append(
                {
                    "id": task + "/" + label,
                    "version": VERSION,
                    "goal": GOAL,
                    "activity": ACTIVITY,
                    "task": task,
                    "request": copy.deepcopy(request),
                    "stdout": json.dumps(result, sort_keys=True) + "\n",
                    "decision": "met" if label == "repaired" else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS10/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS10-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
