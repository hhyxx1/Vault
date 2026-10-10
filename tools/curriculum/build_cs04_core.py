"""Original bounded algorithm experiments; fixed observations never certify proofs."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS04-core-scope-0.1.0",
    "CS04-core-practice-0.1.0",
    "27 目标具备受限 Python 实践；正确性证明、一般资源界、独立迁移和完整分配／路线项目待建设及复核。",
    course="CS04",
    standard="code-fixed-condition-v1",
)
SOURCES = [
    ("odu-knapsack", "Old Dominion CS361 Knapsack", "https://www.cs.odu.edu/~zeil/cs361/f25-web/Public/knapsack/index.html", "0/1 include/exclude state and capacity contract; descending compression is our dependency derivation"),
    ("cmu-complement", "CMU 15-451 NP Completeness", "https://www.cs.cmu.edu/~avrim/451f13/lectures/lect1031.pdf", "section 4 independent set and vertex cover complement"),
    (
        "cornell-invariants",
        "Cornell CS2112 Loop Invariants",
        "https://www.cs.cornell.edu/courses/cs2112/2015fa/lectures/lec_loopinv/",
        "establishment, preservation, postcondition, termination",
    ),
    (
        "mit-merge",
        "MIT 6.006 Sorting",
        "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/6d1ae5278d02bbecb5c4428928b24194_MIT6_006S20_lec3.pdf",
        "merge and recurrence",
    ),
    (
        "mit-greedy",
        "MIT 6.046 Interval Scheduling",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/7f4951b37f95a0046b215c6abec3af59_MIT6_046JS12_lec02.pdf",
        "2.2 unweighted interval scheduling and exchange",
    ),
    (
        "mit-dp",
        "MIT 6.006 Recursive Algorithms",
        "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/9eb3e9a51a7b5b60b0f67c2277f8b0ee_MIT6_006S20_lec15.pdf",
        "subproblems, relation, base, original problem, time",
    ),
    (
        "stanford-search",
        "Stanford CS106B Recursive Backtracking",
        "https://web.stanford.edu/class/archive/cs/cs106b/cs106b.1262/lectures/11-backtracking1/",
        "subsets and choose/explore/unchoose",
    ),
    (
        "mit-paths",
        "MIT 6.006 Dijkstra",
        "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/d819e7f4568aced8d5b59e03db6c7b67_MIT6_006S20_lec13.pdf",
        "nonnegative weights and algorithm restrictions",
    ),
    (
        "mit-mst",
        "MIT 6.046 Minimum Spanning Trees",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/6baf48ebe3babed294c31a907a916e08_MIT6_046JS12_lec03.pdf",
        "3.1 trees and connectivity; greedy counterexamples",
    ),
    (
        "mit-flow",
        "MIT 6.046 Network Flow",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/7c2927794e61bd70c14c07728fa54375_MIT6_046JS12_lec13.pdf",
        "13.1 capacity, conservation and residual augmenting paths",
    ),
    (
        "mit-amortized",
        "MIT 6.046 Amortized Analysis",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/83b82d45beb3776da72b7f3e1b3f42df_MIT6_046JS12_lec11.pdf",
        "11.1 aggregate; 11.3 potential",
    ),
    (
        "mit-random",
        "MIT 6.046 Randomized Algorithms",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/cc13d40706471ea882c39f315861ce64_MIT6_046JS12_lec08.pdf",
        "8.1 expected cost and random selection",
    ),
    (
        "python-random",
        "Python3.13 Random",
        "https://docs.python.org/3.13/library/random.html",
        "Random, seed and reproducibility",
    ),
    (
        "mit-np",
        "MIT 6.046 Complexity and NP",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/b4562881f2af637e09e806450e9b62c8_MIT6_046JS12_lec17.pdf",
        "17.2 certificates and polynomial reductions",
    ),
    (
        "mit-approx",
        "MIT 6.046 Polynomial-Time Approximations",
        "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2012/aeeb7d25b6b22cb4bfa76671d69a0324_MIT6_046JS12_lec18.pdf",
        "18.1 vertex cover via both endpoints of matching",
    ),
]
book.package["sources"] = [
    {
        "id": key,
        "title": title,
        "url": url,
        "locator": locator,
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
    for key, title, url, locator in SOURCES
]


def add(
    module,
    objective,
    title,
    theory,
    source,
    code,
    wrong,
    right,
    before,
    after,
    changed_before,
    changed_after,
    variant,
):
    goal = f"CS04-M{module:02d}-O{objective:02d}"
    initial = "n = int(input())\n" + code.strip() + "\n"
    assert wrong in initial, goal
    repaired = initial.replace(wrong, right)
    cases = []
    for task, label, stdin, first, second in [
        ("base", title, "1\n", before, after),
        ("changed-condition", variant, "2\n", changed_before, changed_after),
    ]:
        request = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": initial},
            "stdin": stdin,
        }
        answer = {**request, "files": {"main.py": repaired}}
        cases.append(
            (
                task,
                label,
                "先写输入约束及预测，运行并保存反例，修改后解释哪些结论尚未证明。",
                request,
                answer,
                first,
                second,
            )
        )
    book.add(
        goal,
        title,
        "标注契约与证据，再用实际运行定位违反条件的步骤。",
        [
            theory,
            "本例的固定运行只支持列出的观察；证明、一般界和独立迁移不由输出代替。",
        ],
        [
            "先区分输出错误、输入前提变化和论证缺口。",
            "检查最小反例与边界，并解释修改依据。",
        ],
        [source],
        cases,
    )


add(
    1,
    1,
    "未命中的查找不能返回插入位置",
    "约定输入已排序，返回命中下标，未命中为 -1。lower_bound 的插入位置与查找结果是不同契约，空表也可能返回位置零。",
    "cornell-invariants",
    """from bisect import bisect_left
a = [2, 4, 6] if n == 1 else []
key = 5
pos = bisect_left(a, key)
answer = pos
print(answer)""",
    "answer = pos",
    "answer = pos if pos < len(a) and a[pos] == key else -1",
    "2\n",
    "-1\n",
    "0\n",
    "-1\n",
    "空数组不能解释为下标零命中",
)
add(
    1,
    2,
    "前缀和循环逐步检查状态不变量",
    "这里在每次处理 a[i] 后检查累计值等于 a[0..i] 的和。真实反例可推翻错误状态，但有限断言通过不构成对所有输入的建立、保持、结束与终止证明。",
    "cornell-invariants",
    """a = [2, 3, 4] if n == 1 else [2]
total = 0
checks = []
for i in range(len(a)):
    total += a[0]
    checks.append(total == sum(a[:i + 1]))
print(checks)""",
    "total += a[0]",
    "total += a[i]",
    "[True, False, False]\n",
    "[True, True, True]\n",
    "[True]\n",
    "[True]\n",
    "单元素数组无法区分首项与当前项",
)
add(
    1,
    3,
    "代价模型必须统计真正执行的基本操作",
    "此例每一对索引执行一次比较，将这一比较作为基本代价。计数随规模变化可用于推导表达式；壁钟耗时和一个规模的计数都不是渐近界证明。",
    "mit-merge",
    """size = 4 if n == 1 else 2
count = 0
for i in range(size):
    count += 1
    for j in range(size):
        same = i == j
print(count)""",
    "    count += 1\n    for j in range(size):\n        same",
    "    for j in range(size):\n        count += 1\n        same",
    "4\n",
    "16\n",
    "2\n",
    "4\n",
    "缩小规模后仍按同一比较模型计数",
)
add(
    2,
    1,
    "递推不能忽略奇数规模的另一半",
    "约定 T(1)=1，分解规模为 floor(n/2) 与 ceil(n/2)，每层合并代价为 n。奇数规模的两支不等长，写成两倍左支会漏掉工作量。",
    "mit-merge",
    """def cost(size):
    if size <= 1:
        return 1
    left = size // 2
    return cost(left) + cost(left) + size
print(cost(3 if n == 1 else 4))""",
    "cost(left) + cost(left)",
    "cost(left) + cost(size - left)",
    "5\n",
    "8\n",
    "12\n",
    "12\n",
    "偶数划分不能暴露两支规模差异",
)
add(
    2,
    2,
    "归并结束后保留未消耗的有序尾段",
    "归并从两段的当前最小项选择，下标越界前停止主循环，然后保留剩余尾段。输出既须有序，也须保留输入多重集合，不允许悄悄少一个元素。",
    "mit-merge",
    """left = [1, 4] if n == 1 else [1, 6]
right = [2, 3, 5] if n == 1 else [2, 3]
i = j = 0
out = []
while i < len(left) and j < len(right):
    if left[i] <= right[j]:
        out.append(left[i]); i += 1
    else:
        out.append(right[j]); j += 1
out.extend(left[i:])
print(out)""",
    "out.extend(left[i:])",
    "out.extend(left[i:])\nout.extend(right[j:])",
    "[1, 2, 3, 4]\n",
    "[1, 2, 3, 4, 5]\n",
    "[1, 2, 3, 6]\n",
    "[1, 2, 3, 6]\n",
    "换为左段仍有剩余元素",
)
add(
    2,
    3,
    "递归树一层的总工作不是一单位",
    "对二次幂规模，T(n)=2T(n/2)+n 的每个内部层总代价为 n，叶层合计为 n。这里分别累加层与叶的固定代价，通用替换法和主定理的前提另需论证。",
    "mit-merge",
    """size = 4 if n == 1 else 8
width = 1
total = size
while width < size:
    total += 1
    width *= 2
print(total)""",
    "total += 1",
    "total += size",
    "6\n",
    "12\n",
    "11\n",
    "32\n",
    "增加递归深度，核对每层总工作",
)
add(
    3,
    1,
    "区间数量最大化比较结束时间",
    "此任务所有区间权重相同，允许前一区间结束时后一区间开始。最早结束的选择保留后续可用时间；最早开始可能占满时段。加权目标需要另选算法。",
    "mit-greedy",
    """intervals = [(0, 10), (1, 2), (2, 3), (3, 4)] if n == 1 else [(0, 1), (1, 2)]
end = float('-inf')
chosen = []
for start, finish in sorted(intervals, key=lambda x: x[0]):
    if start >= end:
        chosen.append((start, finish)); end = finish
print(len(chosen))""",
    "key=lambda x: x[0]",
    "key=lambda x: x[1]",
    "1\n",
    "3\n",
    "2\n",
    "2\n",
    "兼容区间的起止顺序恰好一致",
)
add(
    3,
    2,
    "交换后的首区间应检查结束约束",
    "无权区间交换论证用不晚于旧首区间的结束时间保证后续仍兼容，而不是要求新首区间开始更早。这里只运行一次具体交换，通用归纳论证仍需独立复核。",
    "mit-greedy",
    """old = (0, 10)
new = (1, 2) if n == 1 else (0, 2)
next_interval = (10, 11)
compatible = new[0] <= old[0]
print(compatible)""",
    "new[0] <= old[0]",
    "new[1] <= old[1] and new[1] <= next_interval[0]",
    "False\n",
    "True\n",
    "True\n",
    "True\n",
    "起点相同仍应检查结束时间",
)
add(
    3,
    3,
    "贪心找零需要反例而非直接标为最优",
    "硬币 4、3、1 下，金额六的最大面值优先选择不是最少枚数。动态规划枚举各可能末硬币得到该小实例最优值；这一反例推翻的是通用贪心主张。",
    "mit-mst",
    """coins = [4, 3, 1]
amount = 6 if n == 1 else 4
remaining = amount
greedy = 0
for coin in coins:
    greedy += remaining // coin; remaining %= coin
dp = [0] + [100] * amount
for value in range(1, amount + 1):
    dp[value] = min(dp[value - coin] + 1 for coin in coins if coin <= value)
optimal = greedy
print(f'greedy={greedy} optimal={optimal}')""",
    "optimal = greedy",
    "optimal = dp[amount]",
    "greedy=3 optimal=3\n",
    "greedy=3 optimal=2\n",
    "greedy=1 optimal=1\n",
    "greedy=1 optimal=1\n",
    "贪心在另一个金额上碰巧最优",
)
add(
    4,
    1,
    "0/1 背包压缩状态不能重复使用当前物品",
    "dp[c] 表示已处理物品在不超过容量 c 下的最大价值。压缩一维后，从高容量向低容量更新以读取上一物品阶段；向前更新会变成可重复取同件物品。",
    "mit-dp",
    """capacity = 4 if n == 1 else 2
dp = [0] * (capacity + 1)
for weight, value in [(2, 3)]:
    for c in range(weight, capacity + 1):
        dp[c] = max(dp[c], dp[c - weight] + value)
print(dp[capacity])""",
    "range(weight, capacity + 1)",
    "range(capacity, weight - 1, -1)",
    "6\n",
    "3\n",
    "3\n",
    "3\n",
    "容量只能容纳一件时无法暴露重复使用",
)
add(
    4,
    2,
    "恰好凑成金额的不可达状态不能当作零枚硬币",
    "此任务要求恰好凑成目标，dp[0]=0，其余初始不可达。把不可达也初始化为零会虚构免费方案；可达性与目标值是不同事实。",
    "mit-dp",
    """amount = 3 if n == 1 else 4
INF = 100
dp = [0] * (amount + 1)
dp[0] = 0
for value in range(1, amount + 1):
    if value >= 2:
        dp[value] = min(dp[value], dp[value - 2] + 1)
print('unreachable' if dp[amount] >= INF else dp[amount])""",
    "dp = [0] * (amount + 1)",
    "dp = [INF] * (amount + 1)",
    "0\n",
    "unreachable\n",
    "0\n",
    "2\n",
    "改为可达金额，区分边界与递推",
)
add(
    4,
    3,
    "恢复方案的物品编号与状态行号不同",
    "dp 的第 i 行包含前 i 件物品，选择该行新物品时实际零基编号为 i-1。恢复方案还需核对重量、价值和物品不重复；单个最优值不包含这些证据。",
    "mit-dp",
    """items = [(2, 3), (3, 4)]
capacity = 3 if n == 1 else 2
dp = [[0] * (capacity + 1) for _ in range(3)]
for i, (weight, value) in enumerate(items, 1):
    for c in range(capacity + 1):
        dp[i][c] = dp[i - 1][c]
        if c >= weight:
            dp[i][c] = max(dp[i][c], dp[i - 1][c - weight] + value)
chosen = []; c = capacity
for i in range(2, 0, -1):
    if dp[i][c] != dp[i - 1][c]:
        chosen.append(i); c -= items[i - 1][0]
print(sorted(chosen))""",
    "chosen.append(i);",
    "chosen.append(i - 1);",
    "[2]\n",
    "[1]\n",
    "[1]\n",
    "[0]\n",
    "改为第一件物品最优",
)
add(
    5,
    1,
    "子集状态空间需要选择与不选择两支",
    "每个元素可纳入或不纳入，两类分支合起来覆盖全部子集。枚举数量正确也不能独自证明每个子集唯一或满足约束，还须检查解集内容。",
    "stanford-search",
    """items = [1, 2] if n == 1 else []
results = []
def visit(i, chosen):
    if i == len(items):
        results.append(tuple(chosen)); return
    visit(i + 1, chosen + [items[i]])
visit(0, [])
print(len(results))""",
    "    visit(i + 1, chosen + [items[i]])",
    "    visit(i + 1, chosen + [items[i]])\n    visit(i + 1, chosen)",
    "1\n",
    "4\n",
    "1\n",
    "1\n",
    "空集合也有一个子集",
)
add(
    5,
    2,
    "回溯返回后撤销共享路径修改",
    "共享可变路径必须在探索返回后恢复，否则兄弟分支继承前一分支状态。另一种实现可传递独立副本，不需要相同的显式撤销；本例采用共享列表。",
    "stanford-search",
    """length = 2 if n == 1 else 1
path = []; results = []
def visit(depth):
    if depth == length:
        results.append(tuple(path)); return
    for digit in [0, 1]:
        path.append(digit)
        visit(depth + 1)
        # missing undo
visit(0)
print(f'count={len(results)} valid={sum(len(x) == length for x in results)}')""",
    "# missing undo",
    "path.pop()",
    "count=4 valid=1\n",
    "count=4 valid=4\n",
    "count=2 valid=1\n",
    "count=2 valid=2\n",
    "缩短深度仍需要恢复兄弟分支状态",
)
add(
    5,
    3,
    "非负子集和剪枝不能丢掉刚好满足的解",
    "当前总和超过目标且剩余值非负时可以拒绝该支；恰好等于目标仍可能是合法解。若允许负数，超目标剪枝不再一般成立，必须重审前提。",
    "stanford-search",
    """items = [1, 2]
target = 3 if n == 1 else 4
def count(i, total):
    if total >= target:
        return 0
    if i == len(items):
        return int(total == target)
    return count(i + 1, total) + count(i + 1, total + items[i])
print(count(0, 0))""",
    "total >= target",
    "total > target",
    "0\n",
    "1\n",
    "0\n",
    "0\n",
    "目标无法到达时不应虚构解",
)
add(
    6,
    1,
    "负权输入改变最短路算法前提",
    "非负权 Dijkstra 在最小未确定距离上提交节点。存在负权时，该前提不成立；本例改用重复松弛的小型 Bellman-Ford。未覆盖负环检测和不可达输出约定。",
    "mit-paths",
    """edges = [(0, 1, 1), (0, 2, 2), (2, 1, -3 if n == 1 else 3)]
distance = [0, 1000, 1000]
if False:
    for _ in range(2):
        for u, v, w in edges:
            if distance[u] != 1000:
                distance[v] = min(distance[v], distance[u] + w)
else:
    used = set()
    for _ in range(3):
        u = min((x for x in range(3) if x not in used), key=lambda x: distance[x])
        used.add(u)
        for a, b, w in edges:
            if a == u and b not in used:
                distance[b] = min(distance[b], distance[a] + w)
print(distance[1])""",
    "if False:",
    "if any(w < 0 for _, _, w in edges):",
    "1\n",
    "-1\n",
    "1\n",
    "1\n",
    "改为非负边，原算法前提恢复",
)
add(
    6,
    2,
    "最小生成树不能以廉价环代替连通性",
    "Kruskal 按边权考虑边，仅在端点处于不同分量时合并。生成树覆盖全部顶点且无环；同权时允许多个最优树，本任务只观察总权重与连通性。",
    "mit-mst",
    """edges = [(1, 0, 1), (1, 1, 2), (1, 0, 2), (5, 2, 3)] if n == 1 else [(1, 0, 1), (1, 1, 2), (5, 2, 3)]
parent = list(range(4))
def root(x):
    while parent[x] != x:
        x = parent[x]
    return x
chosen = []
for weight, u, v in sorted(edges):
    if True:
        parent[root(u)] = root(v); chosen.append(weight)
        if len(chosen) == 3:
            break
print(f'cost={sum(chosen)} connected={len({root(x) for x in range(4)}) == 1}')""",
    "if True:",
    "if root(u) != root(v):",
    "cost=3 connected=False\n",
    "cost=7 connected=True\n",
    "cost=7 connected=True\n",
    "cost=7 connected=True\n",
    "没有候选环时仍需覆盖全部顶点",
)
add(
    6,
    3,
    "增广必须增加反向残量而非形成负容量",
    "沿给定路径增广时，正向残量减少，反向残量增加，以便以后撤销已有流。增广量不超过路径瓶颈；这里只核对一次已给路径更新，不是完整最大流求解。",
    "mit-flow",
    """residual = [[0, 3, 0], [0, 0, 2], [0, 0, 0]]
delta = 2 if n == 1 else 0
for u, v in [(0, 1), (1, 2)]:
    residual[u][v] -= delta
    residual[v][u] -= delta
print(residual[0][1], residual[1][0])""",
    "residual[v][u] -= delta",
    "residual[v][u] += delta",
    "1 -2\n",
    "1 2\n",
    "3 0\n",
    "3 0\n",
    "零增广不改变残量",
)
add(
    7,
    1,
    "均匀随机枢轴的期望不是最坏值",
    "固定规模下枚举各等概率枢轴，并把较大划分的规模作为观察量。平均该观察量与最坏观察量是不同量；它们不是完整随机选择算法的耗时，也不构成期望线性证明。",
    "mit-random",
    """size = 4 if n == 1 else 1
costs = [max(rank, size - rank - 1) for rank in range(size)]
mean = float(max(costs))
print(f'mean={mean:.2f} worst={max(costs)}')""",
    "mean = float(max(costs))",
    "mean = sum(costs) / len(costs)",
    "mean=3.00 worst=3\n",
    "mean=2.50 worst=3\n",
    "mean=0.00 worst=0\n",
    "mean=0.00 worst=0\n",
    "单元素规模期望和最坏恰好相同",
)
add(
    7,
    2,
    "动态数组扩容的复制计入总成本",
    "初始容量一，每满一次翻倍。计每次写入与扩容复制的已有元素，整个序列的总成本才是摊还分析工件；最昂贵一次追加和序列平均代价不能混为一谈。",
    "mit-amortized",
    """operations = 5 if n == 1 else 1
size = 0; capacity = 1; total = 0
for _ in range(operations):
    if size == capacity:
        total += 0
        capacity *= 2
    size += 1; total += 1
print(total)""",
    "total += 0",
    "total += size",
    "5\n",
    "12\n",
    "1\n",
    "1\n",
    "尚未扩容的一次追加只计写入",
)
add(
    7,
    3,
    "可复现实验不能每次采样重新播同一 seed",
    "在记录 seed 的同一个生成器上推进状态可复现完整序列。每次重建同 seed 生成器只重复首样本。此任务固定三个样本的不同值数量仅用于检错，不评价随机质量或证明概率界。",
    "python-random",
    """from random import Random
seed = n
rng = Random(seed)
values = [Random(seed).randrange(100) for _ in range(3)]
print(len(set(values)))""",
    "Random(seed).randrange(100)",
    "rng.randrange(100)",
    "1\n",
    "3\n",
    "1\n",
    "3\n",
    "换 seed 后仍须推进同一个生成器状态",
)
add(
    8,
    1,
    "顶点覆盖证书要求每条边被覆盖",
    "给定候选集合时检查所有边至少一个端点在集合中；找到一条被覆盖的边不足以接受证书。验证给定证书与寻找最小证书是不同问题。",
    "mit-np",
    """edges = [(0, 1), (1, 2)]
cover = {0} if n == 1 else {1}
valid = any(u in cover or v in cover for u, v in edges)
print(valid)""",
    "valid = any(",
    "valid = all(",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "同时覆盖两条边的证书",
)
add(
    8,
    2,
    "独立集到顶点覆盖使用补集",
    "无向图中集合 S 独立，当且仅当 V\\S 覆盖全部边。对应的决策大小界也要取补。具体小图可检验映射，但一般等价与多项式归约方向仍需论证。",
    "cmu-complement",
    """vertices = {0, 1, 2}
edges = [(0, 1), (1, 2), (0, 2)] if n == 1 else [(0, 1)]
independent = {0}
cover = independent
valid = all(u in cover or v in cover for u, v in edges)
print(valid, len(cover))""",
    "cover = independent",
    "cover = vertices - independent",
    "False 1\n",
    "True 2\n",
    "True 1\n",
    "True 2\n",
    "只有一条边的图，映射仍使用全部顶点补集",
)
add(
    8,
    3,
    "匹配式覆盖取被选边的两个端点",
    "每次取一条剩余边并删除所有与其端点相接的边，两端点都加入覆盖。所取边构成匹配，任何覆盖至少取每条匹配边一个端点，给出二倍界。这里核对有限实例的可行性与界，不把其他启发式也称为二近似。",
    "mit-approx",
    """from itertools import combinations
edges = [(0, 1), (1, 2), (1, 3)] if n == 1 else [(0, 1)]
vertices = {x for edge in edges for x in edge}
remaining = list(edges); cover = set()
while remaining:
    u, v = remaining[0]
    cover.update([u])
    remaining = [(a, b) for a, b in remaining if a not in {u, v} and b not in {u, v}]
optimal = min(len(s) for size in range(len(vertices) + 1) for s in combinations(sorted(vertices), size) if all(u in s or v in s for u, v in edges))
valid = all(u in cover or v in cover for u, v in edges)
print(f'valid={valid} within_bound={len(cover) <= 2 * optimal}')""",
    "cover.update([u])",
    "cover.update([u, v])",
    "valid=False within_bound=True\n",
    "valid=True within_bound=True\n",
    "valid=True within_bound=True\n",
    "valid=True within_bound=True\n",
    "单边图中较小覆盖也可行，必须区分构造契约",
)
add(
    9,
    1,
    "逐任务最便宜分配可能堵住后续任务",
    "两名执行者每人至多一项任务，任务成本依赖执行者。逐项选最便宜可能把稀缺执行者耗尽。本例枚举全部两任务排列验证最优成本，不能据此称大规模优化器已完成。",
    "stanford-search",
    """from itertools import permutations
costs = [[1, 2], [2, 100]] if n == 1 else [[1, 2], [100, 2]]
available = {0, 1}; greedy = 0
for row in costs:
    worker = min(available, key=lambda x: row[x]); greedy += row[worker]; available.remove(worker)
answer = greedy
print(answer)""",
    "answer = greedy",
    "answer = min(sum(costs[job][worker] for job, worker in enumerate(p)) for p in permutations(range(2)))",
    "101\n",
    "4\n",
    "3\n",
    "3\n",
    "局部选择在另一个成本表上恰好最优",
)
add(
    9,
    2,
    "资源约束由各执行者容量定义",
    "每任务分配恰一次，但执行者可能允许多任务。不能把分配完全不重复当作通用容量条件；应逐执行者计数并比较其上限。这里只验证已给方案，不证明优化或资源复杂度。",
    "stanford-search",
    """assignment = [0, 1, 1] if n == 1 else [0, 0, 1]
capacity = [1, 2]
valid = len(set(assignment)) == len(assignment)
print(valid)""",
    "len(set(assignment)) == len(assignment)",
    "all(assignment.count(worker) <= limit for worker, limit in enumerate(capacity))",
    "False\n",
    "True\n",
    "False\n",
    "False\n",
    "超出第一名执行者容量应拒绝",
)
add(
    9,
    3,
    "期限约束变化后不能直接选原最低成本方案",
    "新增期限时，先过滤不可行方案，再比较可行成本。原算法的成本最优不代表满足新约束；无可行方案时需明确拒绝，不能借改目标掩盖失败。",
    "stanford-search",
    """plans = [(1, 5), (3, 2)]
deadline = 3 if n == 1 else 6
chosen = min(plans)
print(f'cost={chosen[0]} feasible={chosen[1] <= deadline}')""",
    "chosen = min(plans)",
    "chosen = min(p for p in plans if p[1] <= deadline)",
    "cost=1 feasible=False\n",
    "cost=3 feasible=True\n",
    "cost=1 feasible=True\n",
    "cost=1 feasible=True\n",
    "放宽期限后原低成本方案重新可行",
)

if __name__ == "__main__":
    edges = [
        (
            "M01-O01",
            "M01-O02",
            "application",
            "cornell-invariants",
            "查找契约用于确定不变量需要推出的后置条件。",
        ),
        (
            "M01-O03",
            "M02-O01",
            "application",
            "mit-merge",
            "基本代价模型用于建立分治递推。",
        ),
        (
            "M02-O01",
            "M02-O02",
            "conceptual_association",
            "mit-merge",
            "分解规模与归并工作共同组成递推。",
        ),
        (
            "M02-O01",
            "M02-O03",
            "application",
            "mit-merge",
            "递推式用于层工作和递归树分析。",
        ),
        (
            "M01-O02",
            "M03-O02",
            "conceptual_association",
            "mit-greedy",
            "不变量和交换论证分别说明状态和选择正确性。",
        ),
        (
            "M03-O01",
            "M03-O02",
            "application",
            "mit-greedy",
            "最早结束的选择需要交换理由。",
        ),
        (
            "M03-O03",
            "M04-O01",
            "conceptual_association",
            "mit-dp",
            "局部策略失败后可用显式状态比较可行方案。",
        ),
        (
            "M04-O01",
            "M04-O02",
            "conceptual_association",
            "mit-dp",
            "状态含义决定不可达和边界初始化。",
        ),
        (
            "M04-O02",
            "M04-O03",
            "application",
            "mit-dp",
            "有效状态转移支持恢复实际方案。",
        ),
        (
            "M05-O01",
            "M05-O02",
            "application",
            "stanford-search",
            "状态空间分支通过选择、探索和撤销实现。",
        ),
        (
            "M05-O02",
            "M05-O03",
            "conceptual_association",
            "stanford-search",
            "完整搜索为验证剪枝不丢解提供小实例对照。",
        ),
        (
            "M06-O01",
            "M09-O03",
            "application",
            "mit-paths",
            "负权变化是算法前提失效的具体反例。",
        ),
        (
            "M03-O02",
            "M06-O02",
            "conceptual_association",
            "mit-mst",
            "生成树安全选择同样需要理由，但不能照搬区间论证。",
        ),
        (
            "M06-O03",
            "M09-O02",
            "conceptual_association",
            "mit-flow",
            "容量和守恒分别约束流与分配工件；不宣称任意分配都等于最大流。",
        ),
        (
            "M07-O01",
            "M07-O02",
            "conceptual_association",
            "mit-amortized",
            "随机输入上的期望与操作序列摊还界是不同概念。",
        ),
        (
            "M07-O01",
            "M07-O03",
            "application",
            "python-random",
            "实验需记录种子和生成器状态，但实验不代替期望证明。",
        ),
        (
            "M08-O01",
            "M08-O02",
            "application",
            "mit-np",
            "验证器用于检查归约后的证书与大小条件。",
        ),
        (
            "M08-O01",
            "M08-O03",
            "application",
            "mit-approx",
            "近似值之前必须确认输出是可行覆盖。",
        ),
        (
            "M05-O01",
            "M09-O01",
            "application",
            "stanford-search",
            "小状态空间枚举可反证分配器的局部选择。",
        ),
        (
            "M09-O01",
            "M09-O02",
            "conceptual_association",
            "stanford-search",
            "优化目标与容量可行性需要分别核验。",
        ),
    ]
    for start, end, kind, source, reason in edges:
        book.package["relations"].append(
            {
                "from": "CS04-" + start,
                "to": "CS04-" + end,
                "kind": kind,
                "reason": reason,
                "source_locator": source,
                "course_version_id": book.version,
                "review_state": "authority_checked",
                "source": "原创工件关系："
                + reason
                + " 机制参见 "
                + source
                + "；专业审校不可用。",
            }
        )
    book.save("CS04-core")
