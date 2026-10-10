"""Original executable maximum-flow project with two meaningful errors."""

import copy
import importlib.util
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS04-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS04-M06-O03"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))
REFERENCE = (ROOT / "tools/curriculum/assets/flow_project.py").read_text(
    encoding="utf-8"
)
MAIN = """import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('flow','flow.py')
flow=importlib.util.module_from_spec(spec);spec.loader.exec_module(flow)
data=json.loads(sys.stdin.read())
print(json.dumps(flow.solve(data['nodes'],data['edges'],data['source'],data['sink']),sort_keys=True))
"""
EDGES = [[0, 1, 1], [0, 2, 1], [1, 3, 1], [1, 4, 1], [2, 3, 1], [3, 5, 1], [4, 5, 1]]
CASES = [
    (
        "flow-reverse",
        "反向残量边撤销旧分配",
        "adjacency[v].append((u, identity, -1))",
        "# missing backward residual edge",
        1,
    ),
    (
        "flow-bottleneck",
        "增广量应是最小剩余容量",
        'delta = min(step["residual_before"] for step in path)',
        'delta = max(step["residual_before"] for step in path)',
        2,
    ),
]


def build():
    package = json.loads(
        (
            ROOT / "content/courses/CS04/CS04-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="27目标局部实验与真实最大流增广/反向边/可行性及割证书综合任务；其他算法深度与独立证明仍待完成。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    package["sources"].append(
        {
            "id": "dal-flow-project",
            "title": "Dalhousie Algorithms II augmenting paths",
            "url": "https://web.cs.dal.ca/~nzeh/Teaching/4113/book/maxflow/augpath/ford_fulkerson/algorithm.html",
            "locator": "bottleneck and residual forward/backward updates",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        }
    )
    package["sources"].append(
        {
            "id": "dal-ek-project",
            "title": "Dalhousie Edmonds-Karp",
            "url": "https://web.cs.dal.ca/~nzeh/Teaching/4113/book/maxflow/augpath/edmonds_karp.html",
            "locator": "shortest augmenting path using BFS",
            "checked_at": "2026-10-10",
            "status": "authority_checked",
        }
    )
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    activity["theory"] += [
        "真实Edmonds-Karp从零流开始，用BFS选边数最少的正残量路径；增广量是路径最小残量。正向增加原边流，反向减少已有流；反向边不是新建真实传输通道。",
        "每条原边独立ID，平行/反平行边不合并；非负整数容量，上限16节点/128边。记录每次路径、方向、增广后流；终态检查容量、守恒及源净流。",
        "结束时从源可达集合给割；只有可行流与割容量相等且汇不可达，才有本输入的最优性证书。预算耗尽保持不完整；小图实验不能代替一般性正确性或复杂度证明。",
    ]
    activity["source_refs"] = sorted(
        set(activity["source_refs"] + ["dal-flow-project", "dal-ek-project"])
    )
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS04-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
        if row["goal"] == GOAL:
            row["activity"] = ACTIVITY
    spec = importlib.util.spec_from_file_location(
        "author_flow", ROOT / "tools/curriculum/assets/flow_project.py"
    )
    ref = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ref)
    for task, title, correct, wrong, scale in CASES:
        assert correct in REFERENCE
        starter = REFERENCE.replace(correct, wrong, 1)
        bad = type(ref)("bad_flow")
        exec(compile(starter, "original_author_starter", "exec"), bad.__dict__)  # noqa: S102 - only owner-authored asset
        edges = copy.deepcopy(EDGES)
        if scale == 2:
            edges[0][2] = 3
            edges[2][2] = 2
            edges[5][2] = 2
        data = {"nodes": 6, "edges": edges, "source": 0, "sink": 5}
        good = ref.solve(**data)
        incorrect = bad.solve(**data)
        # Known cut sum: the second construction has source capacity4 / sink capacity3.
        expected = 2 if scale == 1 else 3
        assert (
            good["value"] == good["cut_capacity"] == expected
            and good["feasible"]
            and good["optimal_certificate"]
        )
        assert incorrect != good
        initial = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": MAIN, "flow.py": starter},
            "stdin": json.dumps(data, sort_keys=True) + "\n",
        }
        fixed = {**initial, "files": {"main.py": MAIN, "flow.py": REFERENCE}}
        activity["variants"].append(
            {
                "code": task,
                "title": title,
                "student_action": "预测可行最大流与反向边，实际运行并检查路径/流/割；修改flow.py后重跑，解释反例。",
                "code_request": initial,
                "reference_answer": fixed,
                "prediction_prompt": "哪个先前的分配需要撤销？路径瓶颈与源/汇割给出什么上下界？",
                "reflection_prompt": "区分可行与最优；从真实轨迹解释反向残量边与瓶颈，写出未尝试的独立图。",
            }
        )
        for label, request, result in [
            ("initial", initial, incorrect),
            ("repaired", fixed, good),
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
        (ROOT / f"content/courses/CS04/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS04-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
