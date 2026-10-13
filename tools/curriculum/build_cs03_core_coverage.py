"""Build immutable CS03 0.6.0 with six source-audited core objectives."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from vault_backend.course_checks import cs03_core_coverage as model

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS03-core-practice-0.6.0"
BASE_NAME = "CS03-core-practice-0.5.0"
SCOPE_NOTE = (
    "41 个目标具备原创理论、可执行 C++17 实践工件、从零实现及保密多输入核验。"
    "Q4 专业审校、真实学习者整课体验证据和 Q5 生产发布仍须单独验收。"
    "有限测试不证明一般正确性、开放解释、复杂度证明或学习者掌握。"
)


def stable_id(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + value))


def request(source: str, stdin: str) -> dict:
    return {"language": "cpp17", "entry": "main.cpp", "files": {"main.cpp": source}, "stdin": stdin}


LESSONS = {
    "CS03-M02-O04": {
        "title": "在有序顺序表上实现二分查找",
        "sources": ["ods-sorted-search-20261013", "cs2023-alcore"],
        "starter": "binary_search.cpp",
        "mutate": ("if (values[middle] < target)", "if (values[middle] <= target)"),
        "theory": [
            "二分查找依赖数组按同一比较关系非降序排列；输入无序时，区间淘汰的推理不成立。本活动对每个 target 返回第一个相等位置，未找到返回 -1。",
            "维护半开区间 [low, high)：所有 low 左侧元素都小于 target，high 及右侧元素都不小于 target。每步取 low+(high-low)/2；小于 target 时令 low=mid+1，否则令 high=mid。",
            "循环结束 low==high，指向 lower_bound。再次检查边界并验证相等，才能区分命中和插入位置。半开区间自然处理空数组、全小于、全大于与重复值。",
            "每轮把候选区间长度约减半，时间 O(log n)，额外空间 O(1)。下标 midpoint 用 low+(high-low)/2 可避免 low+high 整数溢出；已排序是算法前提，不计入查找复杂度。",
            "与 M02 顺序表表示有关；与查找树同属查找但成本模型不同：数组随机访问支持对数轮次，链表不能以 O(1) 代价访问中点。",
        ],
        "hints": ["先写出区间不变量以及 low/high 各自的边界含义。", "重复键题目要求第一个位置，因此遇到相等时仍应继续缩小右边界。", "用空数组、首位、末位、重复值和未命中检查终止条件。"],
        "scope": "核验已排序整数数组的 lower_bound 行为；不检查输入是否排序，也不证明复杂度或任意比较器下的正确性。",
        "links": [("CS03-M02-O01", "application", "顺序表提供可随机访问的已排序数组表示；二分查找依赖该存储特性。", "ods-sorted-search-20261013")],
    },
    "CS03-M04-O04": {
        "title": "实现 Boyer–Moore 字符串匹配",
        "sources": ["ods-boyer-moore-20261013", "cs2023-alcore"],
        "starter": "boyer_moore.cpp",
        "mutate": ("offset += shift[0];", "offset += m;"),
        "theory": [
            "本活动在字节/ASCII 字符串上查找模式的全部起始位置，返回重叠匹配；空模式约定匹配文本的全部边界。索引从 0 开始。",
            "Boyer–Moore 将模式与文本对齐后从模式右端向左比较。失配时坏字符规则根据失配字符在模式中的最后出现位置右移；好后缀规则利用已经匹配的后缀寻找下一次可能对齐。",
            "取两种合法位移建议的较大值可避免无谓比较，同时不越过可能解。命中后使用好后缀位移继续扫描，不能直接跳过整个模式，否则会漏掉重叠匹配。",
            "预处理时间与模式长度有关，常用坏字符表为字符集大小空间；基本 Boyer–Moore 在最坏情况下可退化到 O(nm)，因此不应把平均跳跃效果说成普遍线性最坏界。",
            "KMP 通过前缀/后缀信息保证线性扫描；Boyer–Moore 倒序比较并用失配启发式跳跃。两者面对重复模式和字符集分布时的行为不同。",
        ],
        "hints": ["手动记录一次从右向左的比较及两条位移规则。", "模式命中后，考虑模式自身的最长可复用前后缀，保留重叠候选。", "用周期文本、重复字符、空模式和模式长于文本分别验证。"],
        "scope": "核验给定 ASCII/字节串上的全部匹配位置与重叠；不覆盖 Unicode 字素、流式文本或最坏时间线性变体。",
        "links": [("CS03-M04-O02", "conceptual_association", "KMP 与 Boyer–Moore 都是精确字符串匹配算法，但使用不同的失配信息和扫描方向。", "ods-boyer-moore-20261013")],
    },
    "CS03-M07-O05": {
        "title": "实现 Prim 最小生成森林",
        "sources": ["ods-prim-mcst-20261013", "cs2023-alcore"],
        "starter": "prim_forest.cpp",
        "mutate": ("std::greater<Candidate>", "std::less<Candidate>"),
        "theory": [
            "输入为无向带权图；要求每个连通分量内连接全部顶点且总权最小。图不连通时结果是最小生成森林，分量各有一棵树；孤立点形成单点分量。",
            "Prim 从一个未访问顶点开始，把当前树连接到未加入顶点的最轻边加入前沿；选中边的另一端成为新顶点。重复直至前沿为空，再从其他未访问顶点开始。",
            "优先队列候选边可能过期；弹出时必须跳过终点已访问的边，否则会产生环。自环不加入树，平行边保留为不同候选；负权边可用，因为问题只比较边权。",
            "邻接表加二叉堆的常见实现时间 O(E log E)、空间 O(V+E)。权值相同可能产生多种不同边集合；核验必须检查结构、分量数和总权，而不能锁定唯一边列表。",
            "Kruskal 按全图边权递增并用并查集拒绝成环；Prim 从各分量边界逐步扩展。连通图下二者都求 MST，不连通图下可形成最小生成森林。",
        ],
        "hints": ["从每个尚未访问的分量起点开始，不要只处理顶点 0 所在分量。", "每次弹出边时检查两端是否已经在树中；只在连接新顶点时计入成本。", "等权边允许多种答案，核对森林性质和总成本。"],
        "scope": "语义比较器核验有限无向图上的生成森林合法性与最优总权；不验证代码内部是否真的采用 Prim 或复杂度。",
        "links": [("CS03-M07-O03", "conceptual_association", "Kruskal 与 Prim 都构造最小生成树/森林，但采用全图边排序与分量前沿扩展两种策略。", "ods-prim-mcst-20261013")],
    },
    "CS03-M08-O04": {
        "title": "实现 Floyd–Warshall 全点对最短路",
        "sources": ["ods-floyd-20261013", "cs2023-alcore"],
        "starter": "floyd_warshall.cpp",
        "mutate": ("if (weight < distance[from][to])", "if (weight == distance[from][to])"),
        "theory": [
            "距离矩阵 D[i][j] 初始化为最轻直接边；对角线为 0；无边用 INF 表示。平行边取最小权重。活动使用有向图，可含负边，但不允许负权环存在时定义有限最短路。",
            "按中间顶点集合逐步扩展：允许使用顶点 k 后，D[i][j]=min(D[i][j], D[i][k]+D[k][j])。外层必须按 k 推进；这是对中间顶点集合的动态规划，而不是任意三重循环。",
            "INF 表示不可达；加法前必须确认两段均可达，避免无穷哨兵溢出。算法结束若任一 D[i][i]<0，则图中存在负权环，本活动输出 negative-cycle。",
            "时间 O(V^3)，空间 O(V^2)。它可处理负边且计算所有起终点对；稀疏图可能更适合逐源运行 Dijkstra/Bellman–Ford。",
            "与 M08 单源最短路构成比较：Dijkstra 不适用于任意负边；Bellman–Ford 可处理负边并检查从源点可达的负环；Floyd–Warshall 一次计算全点对。",
        ],
        "hints": ["把外层 k 解释为当前允许的中间节点集合，按这个不变量写循环。", "为 INF 加法设置守卫，并用负边、重复边和不可达节点检查初始化。", "含负环时有限最短距离无定义，先检查对角线再输出矩阵。"],
        "scope": "核验有限小图的整数权全点对距离；任意负环采用全图统一 negative-cycle 输出，不覆盖溢出域和大规模性能。",
        "links": [("CS03-M08-O01", "conceptual_association", "Floyd–Warshall 扩展为全点对动态规划，单源 Dijkstra/Bellman–Ford 采用不同边权前提。", "ods-floyd-20261013")],
    },
    "CS03-M09-O05": {
        "title": "实现带墓碑的二次探查",
        "sources": ["ods-quadratic-probing-20261013", "cs2023-alcore"],
        "starter": "quadratic_probing.cpp",
        "mutate": ("states_[slot] = State::Tombstone;", "states_[slot] = State::Empty;"),
        "theory": [
            "本实现固定素数容量 M=11，初始位置 h(k)=floorMod(k,M)，第 i 次探查为 (h(k)+i^2) mod M。负键也须归一到非负槽位。",
            "二次探查减少线性探查的主聚集，但这组序列不会遍历全部槽位；容量 11 时每个起点仅访问六个不同槽位。素数容量且负载低于一半时保证探查序列中有空位。",
            "查找遇到真正未使用槽位即可停止；删除后的墓碑不能当空位，否则后续碰撞键会不可达。插入可复用第一个墓碑，但继续探查以避免产生重复键。",
            "探查序列用尽时可能返回 full，即使表中其他槽仍空；这正是该策略的结构限制。装载率、探查覆盖和墓碑比例影响性能，平均成本结论依赖键分布与负载假设。",
            "与线性探查共享开放定址和墓碑删除语义；与 M09 分离链接相比，开放定址记录放在表槽内，但探查覆盖不总等于容量。",
        ],
        "hints": ["先列出 h、h+1、h+4、h+9…的槽位序列，再检查重复槽。", "删除标记需区分从未使用、当前占用、删除墓碑三种状态。", "用负键、同余键、删除链中间元素、重复插入和超过半载的探查限制验证。"],
        "scope": "核验固定 M=11 的整数命令语义与墓碑逻辑；不等价于任意容量、任意二次多项式或生产级自动扩容哈希表。",
        "links": [("CS03-M09-O02", "application", "墓碑删除规则沿用开放定址查找的探查链语义；二次探查改变槽位序列，不改变三态区分。", "ods-quadratic-probing-20261013")],
    },
    "CS03-M10-O05": {
        "title": "实现稳定的有界整数桶排序",
        "sources": ["ods-binsort-20261013", "cs2023-alcore"],
        "starter": "bucket_sort.cpp",
        "mutate": ("buckets[key].push_back({key, tag});", "buckets[key].insert(buckets[key].begin(), {key, tag});"),
        "theory": [
            "本活动将键域限制为整数 [0,K]，每个记录包含 key 与身份 tag；把记录放入对应桶，再按桶号输出。相同键的记录应保持输入顺序。",
            "桶/计数分配利用已知有限键域；直接地址计数桶并存放记录的时间 O(n+K)，空间 O(n+K)。当 K 远大于 n 时空间成本可能不合算。",
            "稳定性来自同一桶内按输入顺序追加并按顺序输出。只核验键有序会漏掉记录丢失、重复和同键次序变化，因此 tag 随记录一起比较。",
            "直接地址桶适用于有界离散键；一般 bucket sort 将值域划为区间桶，再对桶内元素排序，成本还取决于分布和桶内排序。不能把这两个条件化模型与通用比较排序混为一谈。",
            "与基数排序都利用非比较式分配；本目标按完整小整数键一次分桶，基数排序对键的多个 digit 逐轮稳定分配。",
        ],
        "hints": ["先检查所有键是否落在题目给定的 [0,K]。", "在每个桶中追加而不是反向插入，再按键值遍历桶。", "用重复键标签和 K=0 测试稳定性与最小域边界。"],
        "scope": "核验有限非负整数域上的稳定直接分桶；不覆盖实数区间桶内排序或键域超出声明范围。",
        "links": [("CS03-M10-O04", "conceptual_association", "直接桶按完整有界键分配一次；LSD 基数排序按多个 digit 重复进行稳定分配。", "ods-binsort-20261013")],
    },
}


def activity(goal: str, correct: str, starter: str) -> dict:
    lesson = LESSONS[goal]
    oracle, _ = model.GOALS[goal]
    visible, independent = model.INPUTS[oracle]
    code = goal + "-CODE"
    comparator = model.COMPARATORS[oracle]
    return {
        "id": stable_id(code),
        "version_id": model.activity_id(goal),
        "code": code,
        "version": code + "@0.6.0",
        "objective_codes": [goal],
        "kind": "code",
        "title": lesson["title"],
        "student_action": "先预测状态与输出，再修复一个真实缺陷；运行边界输入、解释前提并完成从零实现和保密核验。",
        "theory": lesson["theory"],
        "starter": "阅读接口和失败工件，先记录不变量及预测，再运行并根据实测差异修正。",
        "source_refs": lesson["sources"],
        "availability": "practice_ready",
        "completion_limit": lesson["scope"],
        "code_request": request(starter, visible[0]),
        "reference_answer": request(correct, visible[0]),
        "prediction_prompt": "记录关键状态、算法不变量、边界结果与本次预测依据。",
        "reflection_prompt": "解释修改如何恢复不变量、复杂度依赖的前提以及有限测试仍未证明什么。",
        "hints": lesson["hints"],
        "variants": [
            {
                "code": "changed-condition",
                "title": "新边界与结构条件",
                "student_action": "预测新条件的执行轨迹，再修改自己的作品；查看答案后保留帮助使用记录。",
                "code_request": request(starter, visible[1]),
                "reference_answer": request(correct, visible[1]),
                "prediction_prompt": "说明新条件会检验哪条算法不变量。",
                "reflection_prompt": "说明本次结果能支持什么、仍不能支持什么。",
            },
            {
                "code": "from-scratch",
                "title": "从零实现完整接口",
                "student_action": "从空工件实现接口，运行后查看实际差异并记录帮助使用。",
                "code_request": request("#include <iostream>\n\n// Implement the lesson contract and stated boundaries.\nint main() { return 0; }\n", visible[0]),
                "reference_answer": request(correct, visible[0]),
                "prediction_prompt": "写明前提、接口契约和至少一个预计失败的边界条件。",
                "reflection_prompt": "解释实现的不变量与有限自动检查的证明边界。",
            },
        ],
        "check_version": "code-fixed-condition-v1",
        "semantic_suite": {
            "standard_version": "code-semantic-suite-v1",
            "oracle_id": oracle,
            "comparator": comparator,
            "language": "cpp17",
            "visible_cases": [{"code": f"visible-{i + 1}", "stdin": value} for i, value in enumerate(visible)],
            "independent_case_count": len(independent),
            "scope_note": lesson["scope"],
        },
    }


def main() -> None:
    base_path = ROOT / f"content/courses/CS03/{BASE_NAME}/manifest.json"
    package = json.loads(base_path.read_text(encoding="utf-8"))
    expected_base = stable_id(BASE_NAME)
    if package["version"] != BASE_NAME or package["course_version_id"] != expected_base:
        raise ValueError("The immutable CS03 0.5.0 identity changed; inspect before rebuilding.")

    package.update(version=NAME, course_version_id=model.COURSE_VERSION, scope_note=SCOPE_NOTE)
    package["relations"] = [row | {"course_version_id": model.COURSE_VERSION} for row in package["relations"]]

    sources = [
        {"id": "ods-sorted-search-20261013", "title": "OpenDSA: Search in Sorted Arrays", "url": "https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all/fall-2019/Public_Instance/html/SortedSearch.html", "locator": "22.3: sorted-array search, binary-search interval halving and logarithmic cost", "checked_at": "2026-10-13", "status": "authority_checked"},
        {"id": "ods-boyer-moore-20261013", "title": "OpenDSA: Boyer–Moore String Search", "url": "https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all-0013bb43-a12f-4ab3-9b86-73b317f1e37e/fall-2017/Oct7_Test/html/StringSearchBoyerMoore.html", "locator": "33.6: right-to-left comparisons and bad-character alignment; cross-checked against course core outcome", "checked_at": "2026-10-13", "status": "authority_checked"},
        {"id": "ods-prim-mcst-20261013", "title": "OpenDSA CS3: Minimal Cost Spanning Trees", "url": "https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/MCST.html", "locator": "14.6: Prim expansion by minimum edge crossing the current tree boundary", "checked_at": "2026-10-13", "status": "authority_checked"},
        {"id": "ods-floyd-20261013", "title": "OpenDSA CSci 2101: All-Pairs Shortest Paths", "url": "https://opendsa-server.cs.vt.edu/ODSA/Books/CSCI2101/html/Floyd.html", "locator": "9.8: k-path dynamic-programming recurrence, cubic time and distance matrix", "checked_at": "2026-10-13", "status": "authority_checked"},
        {"id": "ods-quadratic-probing-20261013", "title": "OpenDSA CS3: Improved Collision Resolution", "url": "https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/HashCImproved.html", "locator": "10.7.3: quadratic probe sequence coverage and prime-table/less-than-half-load guarantee", "checked_at": "2026-10-13", "status": "authority_checked"},
        {"id": "ods-binsort-20261013", "title": "OpenDSA: Binsort", "url": "https://opendsa-server.cs.vt.edu/ODSA/Books/Everything/html/BinSort.html", "locator": "13.13: direct bins for key values; distinction from range-based bucket sort", "checked_at": "2026-10-13", "status": "authority_checked"},
    ]
    known_sources = {row["id"] for row in package["sources"]}
    package["sources"].extend(row for row in sources if row["id"] not in known_sources)
    cs2023 = next(row for row in package["sources"] if row["id"] == "cs2023-alcore")
    cs2023["locator"] = "AL-A items 2, 5, 6, 12 and 13: binary search; Prim/Kruskal/Floyd; quadratic probing; Boyer–Moore; bucket/radix sorting"

    existing_codes = {row["code"] for row in package["objectives"]}
    for goal, lesson in LESSONS.items():
        if goal not in existing_codes:
            package["objectives"].append({
                "id": stable_id(goal),
                "code": goal,
                "title": lesson["title"],
                "criteria": [
                    {"id": "fixed_condition", "title": "本次固定条件", "verification": "deterministic_checker"},
                    {"id": "explanation", "title": "解释不变量、前提与复杂度边界", "verification": "independent_review_pending"},
                    {"id": "independent_transfer", "title": "新条件下的独立迁移", "verification": "independent_review_pending"},
                ],
            })
            module = goal.rsplit("-O", 1)[0]
            outline = next(row for row in package["outline"] if row["id"] == module)
            outline["children"].append({"kind": "unit", "id": goal + "-unit", "title": lesson["title"], "objective_refs": [goal]})

    for goal, lesson in LESSONS.items():
        source_path = ROOT / "tools/curriculum/cs03" / lesson["starter"]
        correct = source_path.read_text(encoding="utf-8")
        before, after = lesson["mutate"]
        if correct.count(before) != 1:
            raise ValueError(f"Expected one teaching mutation for {goal}; inspect {source_path.name}.")
        starter = correct.replace(before, after, 1)
        package["activities"].append(activity(goal, correct, starter))

    new_relations = []
    for goal, lesson in LESSONS.items():
        for other, kind, reason, source in lesson["links"]:
            new_relations.append({
                "from": goal,
                "to": other,
                "kind": kind,
                "reason": reason,
                "source_locator": source,
                "course_version_id": model.COURSE_VERSION,
                "review_state": "authority_checked",
                "source": "公开课程材料已查阅并逐目标核对；学科专家签署仍未完成。",
            })
    endpoints = {row["code"] for row in package["objectives"]}
    for relation in new_relations:
        if relation["from"] not in endpoints or relation["to"] not in endpoints:
            raise ValueError(f"Unknown graph endpoint: {relation['from']} -> {relation['to']}")
    package["relations"] = [row for row in package["relations"] if row.get("from") not in LESSONS and row.get("to") not in LESSONS] + new_relations

    for activity_row in package["activities"]:
        code = activity_row["code"]
        activity_row["version_id"] = stable_id(code + ":0.6.0")
        activity_row["version"] = code + "@0.6.0"

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
