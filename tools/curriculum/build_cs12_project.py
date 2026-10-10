"""Weighted route search composite, immutable bounded course observations."""

import copy
import importlib.util
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS12-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS12-M02-O02"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))
REFERENCE = (ROOT / "tools/curriculum/assets/search_project.py").read_text(
    encoding="utf-8"
)
INITIAL = REFERENCE.replace(
    "priority = tentative + heuristic(next_node)", "priority = heuristic(next_node)", 1
)
assert REFERENCE != INITIAL
MAIN = """import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('search','search.py')
search=importlib.util.module_from_spec(spec);spec.loader.exec_module(search)
problem=json.loads(sys.stdin.read())
print(json.dumps(search.compare(problem['grid'],problem['start'],problem['goal']),sort_keys=True))
"""
CASES = [
    (
        "route-weighted",
        "综合项目：修复加权路线的贪心优先级",
        [[1, 1, 1], [1, 9, 1], [1, 1, 1]],
        [0, 1],
        [2, 1],
        4,
        10,
    ),
    (
        "route-wall",
        "综合新条件：障碍改变后的加权路线",
        [[1, 1, 1], [1, 7, 1], [1, None, 1]],
        [0, 1],
        [2, 1],
        4,
        8,
    ),
    (
        "route-unreachable",
        "综合边界：无路可达不等于预算不足",
        [[1, None, 1], [1, None, 1]],
        [0, 0],
        [2, 0],
        None,
        None,
    ),
]


def build():
    spec = importlib.util.spec_from_file_location(
        "author_search", ROOT / "tools/curriculum/assets/search_project.py"
    )
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    wrong = type(reference)("author_wrong_search")
    exec(compile(INITIAL, "owner_starter", "exec"), wrong.__dict__)  # noqa: S102 - only owner-authored asset
    package = json.loads(
        (
            ROOT / "content/courses/CS12/CS12-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="27目标局部实践及真实加权网格BFS/A*/Dijkstra路线比较、展开轨迹和障碍反例；全课程深度仍待完成。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    activity["source_refs"] = sorted(set(activity["source_refs"] + ["ai-search"]))
    activity["theory"] += [
        "原创四邻域正进入代价网格项目，A*使用曼哈顿距离乘最小格代价。此条件下启发值一致且可采纳；不是对任意图/启发式承诺最优。BFS最少边数不保证最少加权代价。",
        "输出真实优先队列展开、g/h/priority、父节点恢复的路径和代价，并与独立均匀代价实现比较。无路可达与展开预算耗尽是不同状态；有限差分比较不是所有地图的一般正确性证明。",
    ]
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS12-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
        if row["goal"] == GOAL:
            row["activity"] = ACTIVITY
    for task, title, grid, start, goal, optimal, greedy in CASES:
        problem = {"grid": grid, "start": start, "goal": goal}
        actual = reference.compare(grid, start, goal)
        bad = wrong.compare(grid, start, goal)
        assert actual["astar"]["cost"] == actual["dijkstra"]["cost"] == optimal
        assert bad["astar"]["cost"] == greedy
        first = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": MAIN, "search.py": INITIAL},
            "stdin": json.dumps(problem, sort_keys=True) + "\n",
        }
        fixed = {**first, "files": {"main.py": MAIN, "search.py": REFERENCE}}
        activity["variants"].append(
            {
                "code": task,
                "title": title,
                "student_action": "先预测三种搜索的路径代价，执行并查看真实展开，修改search.py，改变障碍后再次比较。",
                "code_request": first,
                "reference_answer": fixed,
                "prediction_prompt": "优先级是h还是g+h？最短边数路径是否最小代价？预估哪条路线会先展开。",
                "reflection_prompt": "从g/h/priority说明反例与修复；解释启发式适用条件、无路和预算耗尽的区别，列出仍未验证的情形。",
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
                    "decision": "met" if result == actual else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS12/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS12-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
