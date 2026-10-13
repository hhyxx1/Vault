"""Build immutable CS03 linear-depth release without rewriting historical packages."""

import copy
import json
import re
from pathlib import Path

from vault_backend.course_checks import cs03_linear as model
from vault_backend.course_checks.semantic_suites import SUITES

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS03-core-practice-0.3.0"
OLD = "2ddb5945-157f-5611-bfed-e1e84b96f7cd"
META = {
    "CS03-M01-O01": (
        "为顺序表写清可执行操作契约",
        [
            "接口描述可观察行为，存储表示描述实现。先写操作的合法位置、失败结果和失败后状态，再选择数组或链接实现。",
            "本任务是允许重复值的有序序列，不是集合。位置从 0 开始：插入位置为 0 到 n，读取、修改、删除位置为 0 到 n−1。容量已满时合法插入返回 full；非法位置优先返回 invalid，两种拒绝都不得修改状态。",
            "先预测插入 10、20 后在位置 1 插入 15 的结果，再运行错误工件，定位契约与代码判断的差异。P 正序、R 逆序、V 检查表示不变量；空序列打印 empty。",
            "修复后补写一条非法操作前后的相同状态证据。解释顺序表的契约为何不能直接用“键唯一”的集合契约代替。",
        ],
    ),
    "CS03-M01-O02": (
        "让数组与单链表示执行同一操作序列",
        [
            "逻辑顺序不要求物理连续。数组按下标取值；单链表需沿 next 找到节点。相同序列接口可有不同存储表示。",
            "工件同时运行 ArrayList 与 SinglyList，比较每条可观察结果。成功仅说明这些输入上的行为一致，不证明内部表示或一般正确性。",
            "从中间插入开始画出修改前后的 next，再预测后续读取与删除。丢失后继会让后半段不可达；要保留旧后继再接入新节点。",
            "修复后自行设计空表、尾插及连续删除序列。审阅时说明：已知前驱的接链是常数操作，按位置寻找前驱仍可能为线性时间。",
        ],
    ),
    "CS03-M01-O03": (
        "用基本操作计数解释规模与位置的影响",
        [
            "计数模型必须先定义基本操作。本工件数数组取值一次、从头遍历单链节点的访问次数，以及顺序表插删搬移次数，不把运行秒数作为复杂度证明。",
            "输入 n i，每行代表长度与位置。有效读取访问次数为数组 1、链表 i+1；插入搬移 n−i；删除搬移 n−i−1。插入允许 i=n，读取删除不允许。",
            "先比较相同规模下头部和尾部的位置，再比较 n、2n、4n；记录计数表，解释上界依赖位置和操作。固定计数通过仍不证明你的其他代码有相同复杂度。",
            "区分最坏、平均与摊还成本。固定容量数组尾插在有空间时无搬移；动态数组扩容一次可能线性，倍增下连续尾插可摊还常数，不能混为每次最坏常数。",
        ],
    ),
    "CS03-M02-O01": (
        "完成顺序表插入、删除、查找和修改",
        [
            "a[0..n−1] 是有效区域，容量是存储上限。插入前检查位置与容量，删除前检查位置；失败不能留下半次移动。",
            "在位置 i 插入需要从右往左搬移 a[n−1..i]，避免覆盖未移动元素；删除后从左往右搬移 a[i+1..n−1]，再减少长度。",
            "协议：首行容量；I i x 插入，D i 删除并输出原值，G i 读取，S i x 修改，P/R 正逆序，V 检查长度不变量。先预测移位顺序，再修正移动边界。",
            "修复后测试容量 1、满表拒绝、首尾删除、重复元素和非法位置。说明释放一个槽位后为何能再插入，以及插删的最坏搬移数。",
        ],
    ),
    "CS03-M02-O02": (
        "完成单链表全位置操作并保留后继",
        [
            "每个节点拥有数据和后继指针。头插与头删直接改变 head；其他位置先寻找前驱。最后节点 next 为空，空表 head 为空。",
            "插入顺序是新节点 next 接旧后继，再让前驱 next 接新节点。删除先保存待删节点及后继，再绕过节点并释放；不能丢失后半段或访问已释放内存。",
            "与顺序表使用相同输入协议。先标出前驱、目标和后继，然后预测中间删除后仍可访问的元素。V 检查可达节点数与长度是否一致。",
            "完成头、中、尾操作和删空后重建。解释仅改两条链接为何不意味着“按任意位置插入总是 O(1)”；定位前驱的成本须单列。",
        ],
    ),
    "CS03-M02-O03": (
        "维护带哨兵的循环双向链表",
        [
            "哨兵 root 不存业务数据。空表 root.next 与 root.prev 都指向 root；每个数据节点必须同时满足 next.prev 和 prev.next 回到自己。",
            "插入前保存左右邻居，连接新节点与两侧；删除同时修复前后方向。只修 next 会留下损坏的 prev，正向输出可能看似正确。",
            "先画出空表、单节点、两节点，再预测删除唯一节点后的四个链接。V 检查循环终点、长度与双向互逆，不把哨兵作为业务元素打印。",
            "完成首尾和中间插删、逆序输出及删空后再插入。当前定位从头进行，因此按下标查找仍为 O(n)；已定位节点的接链与摘链为 O(1)。",
        ],
    ),
    "CS03-M03-O01": (
        "实现有界栈并推演每次状态",
        [
            "栈是后进先出接口。本工件用 n 表示元素个数，下一次入栈写 a[n]，栈顶是 a[n−1]；空栈没有可读栈顶。",
            "首行容量；push x 返回 ok/full，pop 返回并移除栈顶或 empty，peek 只读，size 输出长度。满栈拒绝不改变已有元素。",
            "先按操作逐行写出栈底到栈顶、长度、输出，再运行初始程序，比较 peek/pop 是否取同一个正确位置。",
            "完成容量 1、连续弹空、弹出后再压入和负数测试。解释 peek 与 pop 的状态差异，并在新输入上独立推演后运行；参考答案查看会保留帮助记录。",
        ],
    ),
    "CS03-M03-O02": (
        "同时完成循环队列与链式队列",
        [
            "队列先进先出。循环数组用 head 指向下一次出队，tail 指向下一次入队，n 区分空与满；全部槽位可用，不采用额外空槽方案。",
            "首行容量；push/pop/peek/size 与栈协议相同但 pop 从队头。索引增加后对容量取模，容量 1 也必须正确，满队列拒绝且不覆盖。",
            "工件另维护首尾指针的链式队列。空队列首次入队同时设置 first/last；最后节点出队后两者都为空，再入队不能连接已释放的旧尾。两个表示的出队值逐次比较。",
            "预测多次回绕与删空后重建，修复环形索引后添加三轮入出队序列。解释 n 的不变量与两种表示的单次操作代价；有限输出测试不证明所有指针更新正确。",
        ],
    ),
    "CS03-M03-O03": (
        "用栈验证三种括号的嵌套",
        [
            "从左到右扫描，每个左括号入栈；右括号必须匹配栈顶类型并弹出。只比较左右总数会把 ([)] 错判为正确。",
            "每一整行是一项输入，允许空行和非括号字符；只处理 () [] {}，其他字符忽略。空输入行平衡；空栈遇右括号或结束仍有左括号都不平衡。",
            "先写出每个括号后的栈，再运行错误工件。修复类型判断后分别试交错、嵌套、未闭合、提前关闭和普通文本。",
            "输出 balanced/unbalanced。实际语言解析还涉及字符串、注释等上下文，本任务不是完整语法分析器；解释为何只有顶层未闭合左括号能匹配当前右括号。",
        ],
    ),
}
BUGS = {
    "array": ("j>i;--j", "j>i+1;--j"),
    "dual": ("new Node{x,p->next}", "new Node{x,nullptr}"),
    "singly": ("prev->next=p->next", "prev->next=nullptr"),
    "circular": ("p->next->prev=p->prev", "/* missing backward repair */"),
    "stack": ("a[n-1]", "a[0]"),
    "queue": ("tail=(tail+1)%cap", "tail=0"),
    "brackets": ("s.back()!=want", "false"),
    "cost": ("j<=i;++j", "j<i;++j"),
}


import cs03_strings_content as strings

META.update(strings.META)
BUGS.update(strings.BUGS)

META["CS03-M05-O03"] = (
    "构建 Huffman 码表并完成编码解码",
    [
        "输入符号数量、各正频率、消息长度和消息符号编号。每个符号最初作为叶节点，反复合并两棵最小权重树，再按左右分支赋二进制码。",
        "输出 JSON 工件 codes 与 bits，包含所有符号码字及消息的编码。检查器验证码字唯一、前缀无歧义、加权码长最优及编码与消息一致，接受同权分支互换等合法方案。",
        "空字母表只允许空消息；单符号明确使用码字 0，编码长度计为该符号频率。不能把单符号约定与多符号树的合并代价混淆。",
        "先预测两次最小合并，再运行初始工件，修正选树方向。检查不同权重、同权、单符号及空消息，解释前缀性质与最优性适用范围。码表检查不证明所有程序输入的一般正确性。",
    ],
)
BUGS["huffman"] = ("greater<pair<long long,int>>", "less<pair<long long,int>>")


import cs03_trees_content as trees

META.update(trees.META)
BUGS.update(trees.BUGS)


import cs03_search_trees_content as search

META.update(search.META)
BUGS.update(search.BUGS)


import cs03_graphs_content as graphs

META.update(graphs.META)
BUGS.update(graphs.BUGS)


import cs03_hash_sort_content as hash_sort

META.update(hash_sort.META)
BUGS.update(hash_sort.BUGS)

META["CS03-M01-O03"][1].extend(
    [
        "对非负运行代价 T(n)，若足够大的 n 下 T(n)≤C·f(n)，称 T(n)=O(f(n))；同理用下界定义 Ω，同时有上下界为 Θ。常数 C 与阈值不随 n 改变，O 是上界，不是精确等式。",
        "例如 3n+2 为 Θ(n)，也可写成较松的 O(n²)；尾插 0 次搬移仍有写入和边界检查，所以不等于零时间。本工件的搬移计数不是整个过程的全部操作。平均代价需说明输入分布；摊还代价讨论一系列操作，无需假设概率分布。",
    ]
)
META["CS03-M01-O01"][1].append(
    "ADT 用数据对象与操作的前置/后置条件定义行为，表示不变量约束实现。线性序列允许重复并保留位置；集合按唯一键管理，插入同键是拒绝还是替换须另定契约。本课 M06/M09 实作唯一键集合，与此序列接口对照。"
)
META["CS03-M05-O01"][1].append(
    "树的根没有父节点，除根外每节点恰有一个父节点；森林是多棵树的集合。节点的度是孩子数，树的度为最大节点度。路径长度按边数计，根深度为 0；高度按节点层数或边数计的约定必须标明，不能混用。"
)
META["CS03-M05-O02"][1].append(
    "非空二叉树的叶数 n₀ 与双孩子节点数 n₂ 满足 n₀=n₂+1，可由边数 n−1= n₁+2n₂ 推得。满/完全二叉树是不同形状条件；完全树的数组零基孩子下标为 2i+1、2i+2，不能把该数组下标公式套到任意稀疏链接树的节点编号。"
)


def request(source, stdin):
    return {
        "language": "cpp17",
        "entry": "main.cpp",
        "files": {"main.cpp": source},
        "stdin": stdin,
    }


def main():
    path = ROOT / "content/courses/CS03/CS03-core-practice-0.2.0/manifest.json"
    package = json.loads(path.read_text(encoding="utf-8"))
    package.update(
        version=NAME,
        course_version_id=model.COURSE_VERSION,
        scope_note="30 目标具备理论、完整实践工件与保密多输入核验；专业审校不可用，真实模型及生产发布未验收。解释与独立迁移以授权教师实际结论为准，不以有限用例授予全课掌握。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = model.COURSE_VERSION
        if "当前实践深度尚未覆盖链式队列" in relation["reason"]:
            relation["reason"] = "单链节点首尾链接用于链式队列的入队与出队。"
    package["sources"].extend(
        [
            {
                "id": "ods-singly-20261013",
                "title": "Open Data Structures: Singly-Linked List",
                "url": "https://opendatastructures.org/ods-cpp/3_1_Singly_Linked_List.html",
                "locator": "3.1 and 3.1.1: head/tail and empty transitions",
                "checked_at": "2026-10-13",
                "status": "authority_checked",
            },
            {
                "id": "ods-doubly-20261013",
                "title": "Open Data Structures: Doubly-Linked List",
                "url": "https://opendatastructures.org/ods-cpp/3_2_Doubly_Linked_List.html",
                "locator": "3.2 and 3.2.1: sentinel and bidirectional updates",
                "checked_at": "2026-10-13",
                "status": "authority_checked",
            },
        ]
    )
    package["sources"].extend(
        [
            {
                "id": "cmu-mst-20261013",
                "title": "Carl Kingsford / UMD CMSC451 Minimum Spanning Trees",
                "url": "https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/mst.pdf",
                "locator": "Minimum spanning trees, Kruskal and cut property",
                "checked_at": "2026-10-13",
                "status": "authority_checked",
            },
            {
                "id": "mit-bellman-20261013",
                "title": "MIT 6.006 Bellman-Ford",
                "url": "https://www.ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/5edb13fb34cbe7f4cdccc13d131772e7_MIT6_006F11_lec17.pdf",
                "locator": "Bellman-Ford relaxation and reachable negative cycle detection",
                "checked_at": "2026-10-13",
                "status": "authority_checked",
            },
        ]
    )
    package["sources"].append(
        {
            "id": "ods-sort-20261013",
            "title": "Open Data Structures: Comparison-Based Sorting",
            "url": "https://opendatastructures.org/ods-cpp/11_1_Comparison_Based_Sorti.html",
            "locator": "11.1: merge-sort, randomized quicksort and heap-sort; teaching quicksort is deterministic",
            "checked_at": "2026-10-13",
            "status": "authority_checked",
        }
    )
    for activity in package["activities"]:
        goal = activity["objective_codes"][0]
        if goal not in model.GOALS:
            continue
        oracle, kind = model.GOALS[goal]
        filename = (
            "hash"
            if kind.startswith("hash_")
            else "sort"
            if kind.startswith("sort_")
            else "search_tree"
            if kind in {"bst", "avl"}
            else "list"
            if kind in {"array", "singly", "circular", "dual"}
            else kind
        )
        source = (ROOT / f"tools/curriculum/cs03/{filename}.cpp").read_text(
            encoding="utf-8-sig"
        )
        if filename == "list":
            source = (
                f"#define REPRESENTATION { {'array': 0, 'singly': 1, 'circular': 2, 'dual': 3}[kind] }\n"
                + source
            )
        if kind in {"bst", "avl"}:
            source = f"#define BALANCED {int(kind == 'avl')}\n" + source
        wrong, right = BUGS[kind]
        pattern = r"\s*".join(re.escape(char) for char in wrong)
        assert re.search(pattern, source), (goal, wrong)
        starter = re.sub(pattern, lambda _, replacement=right: replacement, source)
        suite = SUITES[(model.COURSE_VERSION, goal)]
        title, theory = META[goal]
        activity.update(
            version_id=model.activity_id(goal),
            version=goal + "-CODE@0.3.0",
            title=title,
            theory=theory,
            source_refs=(
                ["mit-hash", "odsa-hash-delete"]
                if kind.startswith("hash_")
                else ["mit-sort", "ods-sort-20261013"]
                if kind.startswith("sort_")
                else ["odsa-external", "cornell-kmp", "mit-bfs"]
                if kind == "external"
                else ["mit-bfs"]
                if kind == "adjacency"
                else ["mit-dfs", "mit-bfs"]
                if kind == "graph_search"
                else ["cmu-mst-20261013"]
                if kind == "forest"
                else ["mit-dijkstra", "mit-bellman-20261013"]
                if kind == "shortest"
                else ["mit-dfs"]
                if kind == "topology"
                else ["gordon-cpm"]
                if kind == "critical"
                else ["mit-avl"]
                if kind == "avl"
                else ["cmu-bplus"]
                if kind == "bplus"
                else ["mit-trees"]
                if kind == "bst"
                else ["mit-trees"]
                if kind in {"parent_tree", "traversal"}
                else ["odsa-huffman"]
                if kind == "huffman"
                else ["cornell-kmp"]
                if kind in {"naive", "kmp"}
                else ["scipy-coo"]
                if kind == "special"
                else ["mit6006-sequences", "ods-singly-20261013", "ods-doubly-20261013"]
            ),
            code_request=request(starter, suite.visible_cases[0].stdin),
            reference_answer=request(source, suite.visible_cases[0].stdin),
            student_action="预测操作状态→运行差异→结合理论修正→边界实践→保密多输入核验→提交解释与作品审阅。",
            hints=[
                "先逐行记录操作前后的长度与目标位置。",
                "用最小反例定位契约或链接更新错误，避免直接改输出。",
            ],
            prediction_prompt="写出关键操作后的状态、输出与不变量，特别标明拒绝操作。",
            reflection_prompt="解释错误与修正原因、存储与时间代价，并写出一条独立设计的边界操作序列。",
            completion_limit=suite.scope_note,
            semantic_suite={
                "standard_version": suite.standard_version,
                "oracle_id": oracle,
                "comparator": suite.comparator,
                "language": suite.language,
                "visible_cases": [
                    {"code": c.code, "stdin": c.stdin} for c in suite.visible_cases
                ],
                "independent_case_count": len(suite.independent_cases),
                "scope_note": suite.scope_note,
            },
            variants=[
                {
                    "code": "changed-condition",
                    "title": "边界条件与新的操作序列",
                    "student_action": "先独立预测边界状态，再修改工件并运行；查看答案后记录为帮助下练习。",
                    "code_request": request(starter, suite.visible_cases[1].stdin),
                    "reference_answer": request(source, suite.visible_cases[1].stdin),
                    "prediction_prompt": "推演空、满、非法输入之后状态是否保持。",
                    "reflection_prompt": "解释为何新条件暴露旧修改未覆盖的情况。",
                }
            ],
        )
    for activity in package["activities"]:
        goal = activity["objective_codes"][0]
        if goal in model.GOALS:
            activity["variants"].append(
                {
                    "code": "from-scratch",
                    "title": "从零实现完整接口",
                    "student_action": "从空工件独立实现本目标的完整操作与错误分支；先列不变量和边界，再运行多输入核验。查看答案会记录帮助，不自动授予独立掌握。",
                    "code_request": request(
                        "#include <iostream>\n\n// Implement the complete protocol described in this lesson.\nint main() {\n  // Read the input, implement the data structure, and emit the required artifact.\n  return 0;\n}\n",
                        activity["code_request"]["stdin"],
                    ),
                    "reference_answer": activity["reference_answer"],
                    "prediction_prompt": "先列出全部操作、前置/后置条件及需要独立验证的边界。",
                    "reflection_prompt": "说明本实现如何保持不变量、处理失败及满足复杂度要求；注明帮助使用，并提交完整作品审阅。",
                }
            )
    out = ROOT / f"content/courses/CS03/{NAME}/manifest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    catalog_path = ROOT / "content/courses/scope-catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    current = next(row for row in catalog["courses"] if row["code"] == "CS03")
    if current["version_id"] != model.COURSE_VERSION:
        if not any(
            row["version_id"] == current["version_id"]
            for row in catalog["archived_courses"]
        ):
            catalog["archived_courses"].append(copy.deepcopy(current))
        current.update(version_id=model.COURSE_VERSION)
    current.pop("manifest", None)
    current.update(
        version=NAME,
        package_path=f"CS03/{NAME}/manifest.json",
        preferred_for_learning=True,
    )
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(NAME, model.COURSE_VERSION)


if __name__ == "__main__":
    main()
