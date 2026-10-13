"""Build immutable CS03 0.5.0 with standalone union-find and radix-sort units."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from vault_backend.course_checks import cs03_union_find_radix as model

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS03-core-practice-0.5.0"
BASE_NAME = "CS03-core-practice-0.4.0"
SCOPE_NOTE = (
    "35 个目标具备原创理论、可执行 C++17 实践工件与保密多输入核验；专业审校不可用，真实学习者整课证据、"
    "真实模型及生产发布未验收。有限用例不证明一般正确性、复杂度论证或全课掌握。"
)


def stable_id(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + value))


def request(source: str, stdin: str) -> dict:
    return {"language": "cpp17", "entry": "main.cpp", "files": {"main.cpp": source}, "stdin": stdin}


def create_activity(goal: str, title: str, source_refs: list[str], theory: list[str], hints: list[str],
                    scope: str, starter: str, correct: str) -> dict:
    oracle = model.GOALS[goal][0]
    visible, independent = model.INPUTS[oracle]
    code = goal + "-CODE"
    return {
        "id": stable_id(code),
        "version_id": model.activity_id(goal),
        "code": code,
        "version": code + "@0.5.0",
        "objective_codes": [goal],
        "kind": "code",
        "title": title,
        "student_action": "先预测结构状态，再修复故意错误的实现；运行、比较边界条件、完成从零实现和保密多输入核验。",
        "theory": theory,
        "starter": "先写出结构不变量和预测，再运行初始工件并修复实现。",
        "source_refs": source_refs,
        "availability": "practice_ready",
        "completion_limit": scope,
        "code_request": request(starter, visible[0]),
        "reference_answer": request(correct, visible[0]),
        "prediction_prompt": "记录每次操作的集合代表/键序、父指针或计数数组状态及可观察输出。",
        "reflection_prompt": "解释实现为何保持不变量、复杂度结论依赖什么条件，并设计一个新输入验证。",
        "hints": hints,
        "variants": [
            {
                "code": "changed-condition",
                "title": "新的边界条件",
                "student_action": "先预测新条件下的状态变化，再修改作品和核验；参考答案使用情况计入帮助记录。",
                "code_request": request(starter, visible[1]),
                "reference_answer": request(correct, visible[1]),
                "prediction_prompt": "列出新条件与已有反例的差异，并预测结果。",
                "reflection_prompt": "说明这组输入检验了哪条不变量以及还未证明什么。",
            },
            {
                "code": "from-scratch",
                "title": "从零实现完整接口",
                "student_action": "从空文件实现接口，运行后逐项查看差异；不得把参考答案运行记为独立完成。",
                "code_request": request(
                    "#include <iostream>\n\n// Implement the complete interface and invariants from this lesson.\nint main() {\n  return 0;\n}\n",
                    visible[0],
                ),
                "reference_answer": request(correct, visible[0]),
                "prediction_prompt": "先写接口契约、数据表示、不变量和边界行为。",
                "reflection_prompt": "解释每次更新保持不变量的理由并说明有限测试边界。",
            },
        ],
        "check_version": "code-fixed-condition-v1",
        "semantic_suite": {
            "standard_version": "code-semantic-suite-v1",
            "oracle_id": oracle,
            "comparator": "exact",
            "language": "cpp17",
            "visible_cases": [
                {"code": f"visible-{index + 1}", "stdin": value}
                for index, value in enumerate(visible)
            ],
            "independent_case_count": len(independent),
            "scope_note": scope,
        },
    }


def main() -> None:
    base_path = ROOT / f"content/courses/CS03/{BASE_NAME}/manifest.json"
    package = json.loads(base_path.read_text(encoding="utf-8"))
    expected_base = str(uuid5(NAMESPACE_URL, "vault:" + BASE_NAME))
    if package["version"] != BASE_NAME or package["course_version_id"] != expected_base:
        raise ValueError("The immutable CS03 0.4.0 package identity changed; inspect before rebuilding.")

    package.update(version=NAME, course_version_id=model.COURSE_VERSION, scope_note=SCOPE_NOTE)
    for relation in package["relations"]:
        relation["course_version_id"] = model.COURSE_VERSION

    new_sources = [
        {
            "id": "ods-union-find-20261013",
            "title": "OpenDSA CS3: Union/Find and the Parent Pointer Implementation",
            "url": "https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/UnionFind.html",
            "locator": "13.2.1: parent-pointer representation, weighted union, path compression, amortized behavior",
            "checked_at": "2026-10-13",
            "status": "authority_checked",
        },
        {
            "id": "odsa-radix-sort-20261013",
            "title": "OpenDSA CS3: Radix Sort",
            "url": "https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/RadixSort.html",
            "locator": "8.14: stable digit passes, counting distribution, key-width and base assumptions",
            "checked_at": "2026-10-13",
            "status": "authority_checked",
        },
    ]
    known_sources = {row["id"] for row in package["sources"]}
    package["sources"].extend(row for row in new_sources if row["id"] not in known_sources)
    cs2023 = next(row for row in package["sources"] if row["id"] == "cs2023-alcore")
    cs2023["locator"] = (
        "AL-A items 6, 9, and 13: chaining; queues/priority queues/dequeues; bucket and radix sorting"
    )

    additions = [
        (
            "CS03-M07-O04",
            "实现并查集与路径压缩",
            "树的父指针表示不相交集合；从零实现按规模合并、查找压缩、集合大小和集合数。",
        ),
        (
            "CS03-M10-O04",
            "实现稳定的无符号整数基数排序",
            "对带身份标签的 32 位无符号整数记录执行四轮稳定 LSD 基数排序，并解释键宽限制。",
        ),
    ]
    current_codes = {row["code"] for row in package["objectives"]}
    for goal, title, _summary in additions:
        if goal not in current_codes:
            package["objectives"].append(
                {
                    "id": stable_id(goal),
                    "code": goal,
                    "title": title,
                    "criteria": [
                        {"id": "fixed_condition", "title": "本次任务的固定条件", "verification": "deterministic_checker"},
                        {"id": "explanation", "title": "解释不变量、前提与复杂度边界", "verification": "independent_review_pending"},
                        {"id": "independent_transfer", "title": "在独立新条件下验证", "verification": "independent_review_pending"},
                    ],
                }
            )

    outline = {row["id"]: row for row in package["outline"]}
    outline["CS03-M07"]["children"].append(
        {"kind": "unit", "id": "CS03-M07-O04-unit", "title": "实现并查集与路径压缩", "objective_refs": ["CS03-M07-O04"]}
    )
    outline["CS03-M10"]["children"].append(
        {"kind": "unit", "id": "CS03-M10-O04-unit", "title": "实现稳定的无符号整数基数排序", "objective_refs": ["CS03-M10-O04"]}
    )

    uf_path = ROOT / "tools/curriculum/cs03/union_find.cpp"
    uf_correct = uf_path.read_text(encoding="utf-8")
    compression_line = "    parent[x] = root;"
    if uf_correct.count(compression_line) != 1:
        raise ValueError("The union-find path-compression implementation changed; inspect its teaching mutation.")
    uf_starter = uf_correct.replace(compression_line, "    parent[x] = parent[x];", 1)
    radix_path = ROOT / "tools/curriculum/cs03/radix_sort.cpp"
    radix_correct = radix_path.read_text(encoding="utf-8")
    stable_loop = "    for (int i = n - 1; i >= 0; --i) {"
    if radix_correct.count(stable_loop) != 1:
        raise ValueError("The radix distribution loop changed; inspect its stability mutation.")
    radix_starter = radix_correct.replace(stable_loop, "    for (int i = 0; i < n; ++i) {", 1)

    package["activities"].extend(
        [
            create_activity(
                "CS03-M07-O04",
                "实现并查集与路径压缩",
                ["ods-union-find-20261013", "cmu-mst-20261013"],
                [
                    "并查集维护一组互不相交集合。数组 parent[i] 表示父节点，根节点以 parent[root]=root 表示；每个元素初始各自为一组。FIND 沿父指针到根，UNION 仅在两个根不同的情况下合并。",
                    "按规模合并把较小树根接到较大树根；两树等大时本任务保留编号较小的根。只用按规模合并时，节点深度至多随所在集合规模翻倍，树高为 O(log n)。",
                    "路径压缩在查找返回根时，把访问路径上的节点直接接到根。它不改变等价关系或集合划分，只改变父指针；与按规模合并共同使用可改善一系列操作的摊还成本。不能把每次 FIND 的最坏成本说成严格 O(1)。",
                    "命令 U a b 合并并输出 merged/same；C a b 判断同组；S a 返回组大小；N 返回组数；P a 输出压缩前路径边数并执行压缩；V 检查根、组大小和组数。P 是学习用诊断操作，不是并查集的必要公开接口。",
                    "并查集适用于只合并集合的场景；普通并查集不支持删除一条边后拆分集合。Kruskal 通过两端 FIND 判断边是否连接同组，再决定是否 UNION；BFS/DFS 也能求静态连通分量，但回答重复在线合并查询时两者用途不同。",
                ],
                [
                    "每个节点都属于恰好一个根；先找根再改变 parent，不能把任意节点当根。",
                    "按规模合并更新的是新根的 size；已在同组时 size 和 components 都不变。",
                    "P 输出压缩前深度，再压缩路径；再次查询非根节点应只有一条父边。",
                ],
                "核验指定集合操作的结果、按规模合并代表元和路径压缩诊断；有限操作序列不构成一般复杂度证明。",
                uf_starter,
                uf_correct,
            ),
            create_activity(
                "CS03-M10-O04",
                "实现稳定的无符号整数基数排序",
                ["odsa-radix-sort-20261013", "cs2023-alcore"],
                [
                    "每条记录包含无符号 32 位 key 和原始 tag。LSD（最低有效位优先）按低位到高位处理；每轮按当前 digit 稳定分配，前一轮已经建立的低位顺序才会在后续轮次保留。",
                    "本接口固定基数 b=256，每轮处理一个字节，32 位键恰好需要 d=4 轮。先计数，再计算每个桶在输出数组中的起始位置，并稳定写入；只排序 key，tag 随记录移动。",
                    "时间 O(d(n+b))，辅助空间 O(n+b)；对固定的 32 位键和固定 b=256，d 与 b 是常数，因此随记录数 n 线性增长。若键宽、基数、符号表示或字符串长度改变，轮数和适用条件也随之改变。",
                    "检查重复 key 的 tag 顺序、0、最大 uint32、跨字节值、空输入和单条记录。基数排序不是对任意可比较对象都适用的通用替代；它利用可分解的有限位/位数表示，不做元素间比较。",
                    "每轮都必须稳定：相同 digit 的记录按上一轮已有顺序保留。逆序读取并填入累计结束位置是一种稳定实现；正序配合起始位置也可稳定。比较器只核对 key 有序、记录身份完整且相同 key 的 tag 保序。",
                ],
                [
                    "明确当前处理的是哪一个字节，最低字节先处理，最高字节最后处理。",
                    "累计计数表示桶的边界，不是原始频数；写回方向必须与计数语义一致。",
                    "只输出排好序的 key 会掩盖丢失或交换重复记录，必须让 tag 随记录一起核验。",
                ],
                "核验有限组无符号 32 位记录上的稳定 LSD 排序；不涵盖负数、任意精度整数、可变长字符串或其他基数配置。",
                radix_starter,
                radix_correct,
            ),
        ]
    )

    relations = [
        {
            "from": "CS03-M07-O04", "to": "CS03-M07-O03", "kind": "application",
            "reason": "Kruskal 逐边检查两个端点是否已连通，并在接受边后合并集合；并查集支持这个循环。",
            "source_locator": "ods-union-find-20261013", "course_version_id": model.COURSE_VERSION,
            "review_state": "authority_checked", "source": "OpenDSA 13.2.1 明确以 Kruskal 作为并查集应用。",
        },
        {
            "from": "CS03-M07-O04", "to": "CS03-M07-O02", "kind": "conceptual_association",
            "reason": "并查集合并回答增量连通查询；BFS/DFS 从图遍历求连通结构，两者可服务不同查询模式。",
            "source_locator": "ods-union-find-20261013", "course_version_id": model.COURSE_VERSION,
            "review_state": "authority_checked", "source": "OpenDSA 13.2.1 说明并查集用于维护不相交的连通分量。",
        },
        {
            "from": "CS03-M10-O04", "to": "CS03-M10-O02", "kind": "conceptual_association",
            "reason": "基数排序靠键的数字表示和稳定分配工作，不受比较排序下界约束；键域与键宽决定适用条件。",
            "source_locator": "odsa-radix-sort-20261013", "course_version_id": model.COURSE_VERSION,
            "review_state": "authority_checked", "source": "OpenDSA 8.14 介绍逐位稳定分桶及键宽对轮数的影响。",
        },
        {
            "from": "CS03-M10-O01", "to": "CS03-M10-O04", "kind": "conceptual_association",
            "reason": "比较排序使用元素比较建立次序；固定宽度整数基数排序利用 digit 分配，前提和复杂度模型不同。",
            "source_locator": "cs2023-alcore", "course_version_id": model.COURSE_VERSION,
            "review_state": "authority_checked", "source": "CS2023 AL-A 将比较类排序和 O(n) bucket/radix sorting 分别列项。",
        },
    ]
    endpoints = {row["code"] for row in package["objectives"]}
    for relation in relations:
        if relation["from"] not in endpoints or relation["to"] not in endpoints:
            raise ValueError(f"Unknown graph endpoint: {relation['from']} -> {relation['to']}")
    package["relations"] = [
        row for row in package["relations"]
        if not (row.get("from", "").endswith("M07-O04") or row.get("to", "").endswith("M07-O04")
                or row.get("from", "").endswith("M10-O04") or row.get("to", "").endswith("M10-O04"))
    ] + relations

    for activity in package["activities"]:
        activity_code = activity["code"]
        activity["version_id"] = stable_id(activity_code + ":0.5.0")
        activity["version"] = activity_code + "@0.5.0"
    package["relations"] = [
        row | {"course_version_id": model.COURSE_VERSION} for row in package["relations"]
    ]

    output = ROOT / f"content/courses/CS03/{NAME}/manifest.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    catalog_path = ROOT / "content/courses/scope-catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    current = next(row for row in catalog["courses"] if row["code"] == "CS03")
    if current["version_id"] != model.COURSE_VERSION:
        if not any(row["version_id"] == current["version_id"] for row in catalog["archived_courses"]):
            catalog["archived_courses"].append(copy.deepcopy(current))
        current.update(version_id=model.COURSE_VERSION)
    current.update(version=NAME, package_path=f"CS03/{NAME}/manifest.json", preferred_for_learning=True)
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {NAME}: {len(package['objectives'])} objectives, {len(package['activities'])} activities")


if __name__ == "__main__":
    main()
