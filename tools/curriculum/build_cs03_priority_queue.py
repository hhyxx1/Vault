"""Build immutable CS03 0.4.0 with checked core-structure gap objectives."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from vault_backend.course_checks import cs03_priority_queue as model

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS03-core-practice-0.4.0"
OLD_NAME = "CS03-core-practice-0.3.0"
OLD_VERSION = str(uuid5(NAMESPACE_URL, "vault:" + OLD_NAME))
SOURCE = "ods-priority-queue"
DEQUE_SOURCE = "cs2023-alcore"
CHAINING_SOURCE = "ods-open-hashing"
SCOPE_NOTE = (
    "33 个目标具备理论、可执行实践工件与保密多输入核验；专业审校不可用，真实学习者整课证据、"
    "真实模型及生产发布未验收。有限测试不授予一般正确性或全课掌握，解释与独立迁移须由教师实际审阅。"
)
PQ_SCOPE = (
    "核验有限输入上的优先队列命令结果，不证明任意输入下的一般正确性、复杂度证明或独立迁移；"
    "解释、堆不变量和新条件能力须单独审阅。"
)
DEQUE_SCOPE = (
    "核验有限输入上的双端操作与容量状态，不证明任意输入下的一般正确性、复杂度证明或独立迁移；"
    "循环数组不变量与新条件能力须单独审阅。"
)
CHAINING_SCOPE = (
    "核验有限输入上的分离链接字典操作，不证明任意输入下的一般正确性或平均复杂度；"
    "分布假设、链长分析和独立迁移须单独审阅。"
)


def stable_id(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + value))


def request(source: str, stdin: str) -> dict:
    return {"language": "cpp17", "entry": "main.cpp", "files": {"main.cpp": source}, "stdin": stdin}


def practical_activity(goal: str, title: str, oracle_id: str, theory: list[str], hints: list[str],
                       sources: list[str], scope: str, starter: str, correct: str) -> dict:
    visible, independent = model.INPUTS[oracle_id]
    code = goal + "-CODE"
    return {
        "id": stable_id(code),
        "version_id": model.activity_id(goal),
        "code": code,
        "version": code + "@0.4.0",
        "objective_codes": [goal],
        "kind": "code",
        "title": title,
        "student_action": "先预测结构状态，再定位缺陷并执行修正；完成新条件和从零实现，解释不变量后运行多输入核验。",
        "theory": theory,
        "starter": "先写状态变化和边界预测，再运行初始工件并修复结构不变量。",
        "source_refs": sources,
        "availability": "practice_ready",
        "completion_limit": scope,
        "code_request": request(starter, visible[0]),
        "reference_answer": request(correct, visible[0]),
        "prediction_prompt": "逐步记录元素位置、结构不变量、输出及失败分支。",
        "reflection_prompt": "说明修正如何保持不变量、当前结果仍未证明什么，并设计一个新的操作条件。",
        "hints": hints,
        "variants": [
            {
                "code": "changed-condition",
                "title": "新的边界与冲突条件",
                "student_action": "先推演新条件再修改作品；查看答案后将本次尝试标记为帮助下练习。",
                "code_request": request(starter, visible[1]),
                "reference_answer": request(correct, visible[1]),
                "prediction_prompt": "先列出操作前后状态和新条件会暴露的风险。",
                "reflection_prompt": "说明此条件为何不能由上一次输出直接推出。",
            },
            {
                "code": "from-scratch",
                "title": "从零实现完整接口",
                "student_action": "从空文件实现题面接口，独立运行后记录帮助使用和修正过程。",
                "code_request": request(
                    "#include <iostream>\n\n// Implement the complete data-structure protocol from this lesson.\nint main() {\n  return 0;\n}\n",
                    visible[0],
                ),
                "reference_answer": request(correct, visible[0]),
                "prediction_prompt": "先写接口契约、表示不变量和空/满/重复操作预期。",
                "reflection_prompt": "解释每个更新步骤保持不变量的理由，并注明有限测试的证明边界。",
            },
        ],
        "check_version": "code-fixed-condition-v1",
        "semantic_suite": {
            "standard_version": "code-semantic-suite-v1",
            "oracle_id": oracle_id,
            "comparator": "exact",
            "language": "cpp17",
            "visible_cases": [
                {"code": f"visible-{i + 1}", "stdin": stdin} for i, stdin in enumerate(visible)
            ],
            "independent_case_count": len(independent),
            "scope_note": scope,
        },
    }


def main() -> None:
    old_path = ROOT / f"content/courses/CS03/{OLD_NAME}/manifest.json"
    package = json.loads(old_path.read_text(encoding="utf-8"))
    if package["version"] != OLD_NAME or package["course_version_id"] != OLD_VERSION:
        raise ValueError("The immutable CS03 0.3.0 source package does not match its expected identity.")

    package.update(version=NAME, course_version_id=model.COURSE_VERSION, scope_note=SCOPE_NOTE)
    for relation in package["relations"]:
        relation["course_version_id"] = model.COURSE_VERSION

    source_row = {
        "id": SOURCE,
        "title": "OpenDSA CS3: Heaps and Priority Queues",
        "url": "https://opendsa-server.cs.vt.edu/ODSA/Books/CS3/html/Heaps.html",
        "locator": "7.17: complete-tree heap representation, priority-queue operations, insertion and removal",
        "checked_at": "2026-10-13",
        "status": "authority_checked",
    }
    package["sources"] = [row for row in package["sources"] if row["id"] != SOURCE]
    package["sources"].append(source_row)
    extra_sources = [
        {
            "id": DEQUE_SOURCE,
            "title": "ACM/IEEE-CS/AAAI CS2023: AL CS Core",
            "url": "https://csed.acm.org/al-cs-core/",
            "locator": "AL-A items 9 and 6: Queues, Priority Queues, Dequeues; hash collision resolution including chaining",
            "checked_at": "2026-10-13",
            "status": "authority_checked",
        },
        {
            "id": CHAINING_SOURCE,
            "title": "OpenDSA CS3: Open Hashing / Separate Chaining",
            "url": "https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/OpenHash.html",
            "locator": "10.4.1: collision resolution by per-bucket linked lists; average cost depends on distribution",
            "checked_at": "2026-10-13",
            "status": "authority_checked",
        },
    ]
    source_ids = {row["id"] for row in package["sources"]}
    package["sources"].extend(row for row in extra_sources if row["id"] not in source_ids)

    existing_codes = {row["code"] for row in package["objectives"]}
    if model.OBJECTIVE not in existing_codes:
        package["objectives"].append(
            {
                "id": stable_id(model.OBJECTIVE),
                "code": model.OBJECTIVE,
                "title": "实现堆式优先队列",
                "criteria": [
                    {
                        "id": "fixed_condition",
                        "title": "本次任务的固定条件",
                        "verification": "deterministic_checker",
                    },
                    {
                        "id": "explanation",
                        "title": "解释堆不变量、操作与复杂度边界",
                        "verification": "independent_review_pending",
                    },
                    {
                        "id": "independent_transfer",
                        "title": "在独立新条件下验证",
                        "verification": "independent_review_pending",
                    },
                ],
            }
        )

    extra_objectives = [
        {
            "code": "CS03-M03-O05",
            "title": "实现固定容量循环双端队列",
            "criteria": [
                {"id": "fixed_condition", "title": "本次任务的固定条件", "verification": "deterministic_checker"},
                {"id": "explanation", "title": "解释两端操作和循环数组不变量", "verification": "independent_review_pending"},
                {"id": "independent_transfer", "title": "在独立新条件下验证", "verification": "independent_review_pending"},
            ],
        },
        {
            "code": "CS03-M09-O04",
            "title": "比较开放定址与分离链接",
            "criteria": [
                {"id": "fixed_condition", "title": "本次任务的固定条件", "verification": "deterministic_checker"},
                {"id": "explanation", "title": "解释桶链不变量与冲突代价", "verification": "independent_review_pending"},
                {"id": "independent_transfer", "title": "在独立新条件下验证", "verification": "independent_review_pending"},
            ],
        },
    ]
    present = {row["code"] for row in package["objectives"]}
    for objective in extra_objectives:
        objective["id"] = stable_id(objective["code"])
        if objective["code"] not in present:
            package["objectives"].append(objective)

    chapter = next(row for row in package["outline"] if row["id"] == "CS03-M03")
    chapter["children"] = [row for row in chapter["children"] if model.OBJECTIVE not in row.get("objective_refs", [])]
    chapter["title"] = "栈、队列与优先队列"
    chapter["children"].append(
        {
            "kind": "unit",
            "id": model.OBJECTIVE + "-unit",
            "title": "实现堆式优先队列",
            "objective_refs": [model.OBJECTIVE],
        }
    )
    deque_goal = "CS03-M03-O05"
    chapter["children"] = [row for row in chapter["children"] if deque_goal not in row.get("objective_refs", [])]
    chapter["children"].append(
        {"kind": "unit", "id": deque_goal + "-unit", "title": "实现固定容量循环双端队列", "objective_refs": [deque_goal]}
    )
    hash_chapter = next(row for row in package["outline"] if row["id"] == "CS03-M09")
    hash_chapter["title"] = "散列、开放定址与分离链接"
    hash_goal = "CS03-M09-O04"
    hash_chapter["children"] = [row for row in hash_chapter["children"] if hash_goal not in row.get("objective_refs", [])]
    hash_chapter["children"].append(
        {"kind": "unit", "id": hash_goal + "-unit", "title": "比较开放定址与分离链接", "objective_refs": [hash_goal]}
    )

    relation_rows = [
        {
            "from": model.OBJECTIVE,
            "to": "CS03-M05-O03",
            "kind": "application",
            "reason": "Huffman 构造反复取出权重最小的两棵树；优先队列可支持这一贪心步骤。",
            "source_locator": SOURCE,
            "course_version_id": model.COURSE_VERSION,
            "review_state": "authority_checked",
            "source": "OpenDSA 7.17 介绍堆作为优先队列实现；此处关系说明其在 Huffman 合并中的应用。",
        },
        {
            "from": model.OBJECTIVE,
            "to": "CS03-M10-O01",
            "kind": "conceptual_association",
            "reason": "堆排序和优先队列都可使用完全二叉堆的不变量，但堆排序是排序算法，不等同于优先队列接口。",
            "source_locator": SOURCE,
            "course_version_id": model.COURSE_VERSION,
            "review_state": "authority_checked",
            "source": "OpenDSA 7.17 的完全二叉堆表示与第 11 章堆排序共同支持该结构关联。",
        },
    ]
    package["relations"] = [
        row
        for row in package["relations"]
        if not (row.get("from") == model.OBJECTIVE or row.get("to") == model.OBJECTIVE)
    ] + relation_rows
    package["relations"].extend(
        [
            {
                "from": deque_goal,
                "to": "CS03-M03-O02",
                "kind": "conceptual_association",
                "reason": "双端队列允许两端插入和删除；将操作限制在队尾插入、队首删除即可得到 FIFO 队列行为。",
                "source_locator": DEQUE_SOURCE,
                "course_version_id": model.COURSE_VERSION,
                "review_state": "authority_checked",
                "source": "CS2023 AL-A 将 queues 与 dequeues 列为相关但不同的数据结构接口。",
            },
            {
                "from": hash_goal,
                "to": "CS03-M09-O01",
                "kind": "conceptual_association",
                "reason": "分离链接把冲突键放入同一桶的链表，开放定址则继续探查表内槽位；两者是不同冲突解决策略。",
                "source_locator": CHAINING_SOURCE,
                "course_version_id": model.COURSE_VERSION,
                "review_state": "authority_checked",
                "source": "OpenDSA 10.4.1 将 separate chaining 与 open addressing 区分为两类冲突解决方案。",
            },
        ]
    )

    for activity in package["activities"]:
        activity_code = activity["code"]
        activity["version_id"] = stable_id(activity_code + ":0.4.0")
        activity["version"] = activity_code + "@0.4.0"

    source_path = ROOT / "tools/curriculum/cs03/priority_queue.cpp"
    correct = source_path.read_text(encoding="utf-8")
    correct_comparator = "bool higherPriority(long long a, long long b) { return a < b; }"
    broken_comparator = "bool higherPriority(long long a, long long b) { return a > b; }"
    if correct.count(correct_comparator) != 1:
        raise ValueError("The reference heap comparator changed; review the starter mutation before rebuilding.")
    starter = correct.replace(correct_comparator, broken_comparator, 1)
    visible, independent = model.INPUTS[model.ORACLE_ID]
    objective_code = model.OBJECTIVE
    activity_code = objective_code + "-CODE"
    activity = {
        "id": stable_id(activity_code),
        "version_id": model.activity_id(objective_code),
        "code": activity_code,
        "version": activity_code + "@0.4.0",
        "objective_codes": [objective_code],
        "kind": "code",
        "title": "实现堆式优先队列",
        "student_action": "先预测堆数组与交换过程，再定位比较方向错误；修复、运行、解释不变量，并在独立输入上核验。",
        "theory": [
            "优先队列按优先级而非到达顺序提供元素。本任务约定数值越小优先级越高，接口为 push x、top、pop、size；相同优先级可重复且等价，不承诺稳定顺序。它与 FIFO 队列是不同 ADT。",
            "二叉堆是满足完全二叉树形状和局部堆序的结构，不是全局有序数组。本任务用零基数组表示最小堆：父下标为 (i−1)/2，左右孩子为 2i+1 与 2i+2；每个父键不大于孩子键。",
            "push 把新元素放到末尾，再沿父链上滤；pop 移除根，把末元素放到根后沿较小孩子下滤；top 只读根。空堆 top/pop 输出 empty。每次操作后都要同时保持完全树形状和堆序。",
            "高度为 Θ(log n)，所以 push 与 pop 为 O(log n)，top 为 O(1)，size 在本实现中为 O(1)。有限命令测试检查本任务协议的结果，不替代复杂度推导、内存分析或一般正确性证明。",
            "本课 M05 的 Huffman 构造会反复选择最小权重节点，可应用优先队列；M10 的堆排序也使用完全二叉堆，但它执行排序，不能把堆序误认为整个数组已排序。",
        ],
        "starter": "先预测操作后的数组和输出，再运行错误实现并解释比较方向为何破坏最小堆。",
        "source_refs": [SOURCE],
        "availability": "practice_ready",
        "completion_limit": PQ_SCOPE,
        "code_request": request(starter, visible[0]),
        "reference_answer": request(correct, visible[0]),
        "prediction_prompt": "逐次记录数组表示、根、交换路径、size 和输出；特别推演重复键、负数及空堆。",
        "reflection_prompt": "说明完全树形状与堆序如何分别保持，推导 push/pop 的高度上界，并写出一个独立设计的新操作序列。",
        "hints": [
            "先区分根与整个堆：只有根保证是全局最小值，兄弟节点之间不保证有序。",
            "上滤每次比较新节点和父节点；下滤每次选择两个孩子中优先级更高的一个。",
            "重复优先级允许存在；比较器只决定谁先出队，不可假设键唯一。",
        ],
        "variants": [
            {
                "code": "changed-condition",
                "title": "重复值、负优先级与空堆恢复",
                "student_action": "先推演空堆查询、负数入队、重复值弹出及 size，再修正并运行。",
                "code_request": request(starter, visible[1]),
                "reference_answer": request(correct, visible[1]),
                "prediction_prompt": "为每次 push/pop 标出上滤或下滤路径和根值。",
                "reflection_prompt": "解释为何堆数组不需要整体排序仍能在根位置返回最小值。",
            },
            {
                "code": "from-scratch",
                "title": "从零实现优先队列",
                "student_action": "从空文件实现接口、数组索引、上滤和下滤；独立运行后记录帮助情况。",
                "code_request": request(
                    "#include <iostream>\n\n// Implement the min-priority queue protocol from this lesson.\nint main() {\n  return 0;\n}\n",
                    visible[0],
                ),
                "reference_answer": request(correct, visible[0]),
                "prediction_prompt": "先写出空/单元素/重复最小值的操作轨迹和数组索引公式。",
                "reflection_prompt": "说明每条循环每次迭代保持的不变量，并单独推导复杂度。",
            },
        ],
        "check_version": "code-fixed-condition-v1",
        "semantic_suite": {
            "standard_version": "code-semantic-suite-v1",
            "oracle_id": model.ORACLE_ID,
            "comparator": "exact",
            "language": "cpp17",
            "visible_cases": [
                {"code": f"visible-{i + 1}", "stdin": stdin} for i, stdin in enumerate(visible)
            ],
            "independent_case_count": len(independent),
            "scope_note": PQ_SCOPE,
        },
    }
    package["activities"] = [row for row in package["activities"] if row["code"] != activity_code]
    package["activities"].append(activity)

    deque_source = ROOT / "tools/curriculum/cs03/deque.cpp"
    deque_correct = deque_source.read_text(encoding="utf-8")
    deque_mutation = "head = (head + capacity - 1) % capacity;"
    if deque_correct.count(deque_mutation) != 1:
        raise ValueError("The deque front-wrap implementation changed; review its teaching mutation.")
    deque_starter = deque_correct.replace(deque_mutation, "head = (head + 1) % capacity;", 1)
    package["activities"].append(
        practical_activity(
            "CS03-M03-O05",
            "实现固定容量循环双端队列",
            "cs03_deque",
            [
                "双端队列允许在前端和后端插入、删除、查看；它既不限定 FIFO，也不按优先级排序。限制为后端插入、前端删除时得到 FIFO 队列接口。",
                "本活动采用容量固定且至少为 1 的循环数组，用 head 表示首元素位置、size 表示元素数。尾部位置为 (head+size) mod capacity；前插先将 head 向前环绕一格，后插写尾位置。",
                "空/满分别由 size==0 与 size==capacity 判断，因此所有槽位都可使用。前删推进 head，后删减少 size；空/满操作不修改状态。无扩容时两端插删、front/back 与 size 均为 O(1)。",
                "用容量 1 和 2 手工追踪 head、size、首尾槽位；经历回绕后仍要保持逻辑顺序。有限测试只覆盖声明的接口，不证明其他实现或任意操作序列普遍正确。",
            ],
            [
                "分别画物理下标和逻辑顺序；head 不是尾部下标。",
                "push_front 应向较小下标环绕，不能向队尾方向移动。",
                "size 与 head 的意义不同；从单元素删除后，空状态可规范化也可保留任意 head，但后续首尾访问必须正确。",
            ],
            [DEQUE_SOURCE],
            DEQUE_SCOPE,
            deque_starter,
            deque_correct,
        )
    )

    chaining_source = ROOT / "tools/curriculum/cs03/chaining.cpp"
    chaining_correct = chaining_source.read_text(encoding="utf-8")
    duplicate_guard = 'if (found) {\n          cout << "exists\\n";'
    if chaining_correct.count(duplicate_guard) != 1:
        raise ValueError("The chaining duplicate guard changed; review its teaching mutation.")
    chaining_starter = chaining_correct.replace(
        duplicate_guard, 'if (false) {\n          cout << "exists\\n";', 1
    )
    package["activities"].append(
        practical_activity(
            "CS03-M09-O04",
            "比较开放定址与分离链接",
            "cs03_chaining",
            [
                "散列表把键映射到桶位置，碰撞无法完全避免。分离链接为每个桶维护容器，同桶键保存在同一链中；开放定址把记录放在表槽并沿探查序列寻找空槽。二者都需要一致的哈希映射和唯一键契约。",
                "本活动用 vector-of-vectors 表示桶链。对负整数先将余数规范到 [0, capacity)，插入先检查同桶是否已有键；删除只移除目标键，不会像开放定址那样留下墓碑。",
                "命令 I/D/F/P/C/V 分别插入、删除、查找、列出逻辑集合、报告元素数与最大桶长、检查桶映射和唯一性。容量表示桶数而非元素硬上限，同一桶可保存多个键。",
                "若键分布均匀，平均链长与 load factor α=N/M 相关，查找成本期望为 O(1+α)；所有键落在同一桶时仍可退化到 O(n)。代码计数不能替代概率假设和平均代价分析。",
                "OpenDSA 将 separate chaining 也称为 open hashing，将 open addressing 称为 closed hashing；术语容易混淆。本课题面固定使用“分离链接”和“开放定址”避免歧义。",
            ],
            [
                "先比较两个键的桶下标；同桶不表示重复键。",
                "删除一个链内节点后，其他碰撞键仍应可查找。",
                "容量是桶数；分离链接不会因某桶已占用就拒绝其他不同键。",
            ],
            [CHAINING_SOURCE, DEQUE_SOURCE],
            CHAINING_SCOPE,
            chaining_starter,
            chaining_correct,
        )
    )

    out = ROOT / f"content/courses/CS03/{NAME}/manifest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

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
