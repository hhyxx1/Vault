"""Original finite logical models, not an automated proof certification system."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS05-core-scope-0.1.0",
    "CS05-core-practice-0.1.0",
    "30 目标具备有限观察实践；完整证明、环域公理、平面性、独立迁移及离散建模项目待建设。",
    course="CS05",
    standard="code-fixed-condition-v1",
)
book.package["sources"] = [
    {
        "id": "mit-logic",
        "title": "MIT Mathematics for Computer Science",
        "url": "https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/mit6_042js15_textbook.pdf",
        "locator": "3.1–3.3 connectives and equivalence; 3.6 quantifiers and negation",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
]
for key, locator in [
    ("mit-sets", "4.1 sets; 4.3–4.5 functions, arrows and finite cardinality"),
    ("mit-relations", "9.6 partial orders; 9.10 equivalence classes"),
    ("mit-proof", "1.5 implication; 3.3 contrapositive; 5.1 induction"),
    (
        "mit-count",
        "14.4 division rule; 14.9 inclusion-exclusion; recurrence is our last-bit decomposition",
    ),
    ("mit-graph", "11.9 connectivity; 12.4 planar edge bound; 11.7 coloring"),
    ("mit-tree", "11.10 forests, trees and minimum spanning trees"),
]:
    book.package["sources"].append(
        {**book.package["sources"][0], "id": key, "locator": locator}
    )

book.package["sources"].append(
    {
        "id": "milne-group",
        "title": "J. S. Milne Group Theory v4.01",
        "url": "https://www.jmilne.org/math/CourseNotes/GT.pdf",
        "locator": "1.1 groups and operations; homomorphisms",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)

book.package["sources"].append(
    {
        "id": "levin-euler",
        "title": "Oscar Levin Discrete Mathematics: An Open Introduction",
        "url": "https://discrete.openmathbooks.org/dmoi4/sec_gt-paths.html",
        "locator": "Euler trails and circuits; connected graph condition",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)


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
    goal = f"CS05-M{module:02d}-O{objective:02d}"
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
    "蕴涵只在前件真而后件假时失败",
    "材料蕴涵 p→q 等价于 ¬p∨q；前件假时成立。不能把蕴涵写成合取。",
    "mit-logic",
    "p,q = (False,False) if n == 1 else (True,False)\nprint(p and q)",
    "p and q",
    "(not p) or q",
    "False\n",
    "True\n",
    "False\n",
    "False\n",
    "前件真、后件假",
)
add(
    1,
    2,
    "逆否等价而逆命题未必等价",
    "穷举命题变量的完整有限真值表可验证等价；逆否为 ¬q→¬p，逆命题 q→p 一般不等价。",
    "mit-logic",
    "from itertools import product\nrows=list(product([False,True],repeat=2)) if n == 1 else [(False,True)]\nprint(all(((not p) or q) == ((not q) or p) for p,q in rows))",
    "((not q) or p)",
    "(q or (not p))",
    "False\n",
    "True\n",
    "False\n",
    "True\n",
    "反例赋值逐行检验",
)
add(
    1,
    3,
    "反例需要使命题为假",
    "否定全称有效性的反例是使公式为假的赋值，满足公式的赋值不是反例。",
    "mit-logic",
    "rows=[(True,False),(False,True)] if n == 1 else [(False,False),(True,False)]\nfound=[(int(p),int(q)) for p,q in rows if ((not p) or q)]\nprint(found)",
    "if ((not p) or q)",
    "if not ((not p) or q)",
    "[(0, 1)]\n",
    "[(1, 0)]\n",
    "[(0, 0)]\n",
    "[(1, 0)]\n",
    "加入前件假的赋值",
)
add(
    2,
    1,
    "每个学生至少选一门课允许不同见证",
    "∀学生 ∃课程 可选，与 ∃课程 ∀学生 可选不同。先界定两个论域及关系。",
    "mit-logic",
    "students=[0,1]; courses=[0,1]\nchosen={(0,0),(1,1)} if n == 1 else {(0,0),(1,0)}\nprint(any(all((s,c) in chosen for s in students) for c in courses))",
    "any(all((s,c) in chosen for s in students) for c in courses)",
    "all(any((s,c) in chosen for c in courses) for s in students)",
    "False\n",
    "True\n",
    "True\n",
    "True\n",
    "两人共享同一门课",
)
add(
    2,
    2,
    "否定全称需要存在一个否定见证",
    "¬∀x P(x) 等价于 ∃x ¬P(x)。有限空域全称为真、存在为假；Python all/any 的约定也满足这一点。",
    "mit-logic",
    "values=[True,False] if n == 1 else []\nprint(all(not x for x in values))",
    "all(not x for x in values)",
    "any(not x for x in values)",
    "False\n",
    "True\n",
    "True\n",
    "False\n",
    "空论域边界",
)
add(
    2,
    3,
    "同一见证不能放进每个对象内部",
    "存在同一课程供所有学生选择的见证在全称量词外；每个学生各自有见证不足以推出共享见证。有限模型反例不证明无限域的一般公式。",
    "mit-logic",
    "students=[0,1]; courses=[0,1]\nchosen={(0,0),(1,1)} if n == 1 else {(0,1),(1,1)}\nprint(all(any((s,c) in chosen for c in courses) for s in students))",
    "all(any((s,c) in chosen for c in courses) for s in students)",
    "any(all((s,c) in chosen for s in students) for c in courses)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "提供共享见证",
)

add(
    4,
    1,
    "集合差不是对称差",
    "A\\B 保留属于 A 而不属于 B 的元素。对称差还包括仅属于 B 的元素，两种契约不同。",
    "mit-sets",
    "a={1,2}; b={2,3} if n == 1 else set()\nprint(sorted(a ^ b))",
    "a ^ b",
    "a - b",
    "[1, 3]\n",
    "[1]\n",
    "[1, 2]\n",
    "[1, 2]\n",
    "空减数集合",
)
add(
    4,
    2,
    "判断单射需检查不同输入的像",
    "本题使用全函数；单射要求任意不同输入的像不同，满射还取决于指定陪域。仅比较定义域与陪域大小不能接受单射。",
    "mit-sets",
    "domain={0,1}; codomain={0,1}\nf={0:0,1:0} if n == 1 else {0:1,1:0}\nprint(len(domain) == len(codomain))",
    "len(domain) == len(codomain)",
    "set(f) == domain and set(f.values()) <= codomain and len(set(f.values())) == len(domain)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "换成双射映射",
)
add(
    4,
    3,
    "复合函数先作用内层映射",
    "h=g∘f 意味 h(x)=g(f(x))，顺序有意义；完整定义域与中间像必须在 g 的定义域内。此例未覆盖一般逆函数存在条件。",
    "mit-sets",
    "f=lambda x:x+1\ng=lambda x:x*2\nx=1 if n == 1 else 3\nprint(f(g(x)))",
    "f(g(x))",
    "g(f(x))",
    "3\n",
    "4\n",
    "7\n",
    "8\n",
    "更换输入并保留复合顺序",
)
add(
    5,
    1,
    "对称性检查反向边而非对角边",
    "对称性是 aRb 蕴涵 bRa；自反性是每个元素都有 aRa。两个性质不可混为一谈。",
    "mit-relations",
    "domain={0,1}\nr={(0,0),(1,1),(0,1)} if n == 1 else {(0,1),(1,0)}\nprint(all((a,a) in r for a in domain))",
    "all((a,a) in r for a in domain)",
    "all((b,a) in r for a,b in r)",
    "True\n",
    "False\n",
    "False\n",
    "True\n",
    "对称而不自反的关系",
)
add(
    5,
    2,
    "等价类包括代表元及其全部等价元素",
    "模 k 同余在给定整数集合上诱导等价关系；等价类按同余而非整数相等划分，类的范围仍取本题有限论域。",
    "mit-relations",
    "domain=list(range(6)); k=2 if n == 1 else 3\nrepresentative=1\nprint([x for x in domain if x == representative])",
    "x == representative",
    "x % k == representative % k",
    "[1]\n",
    "[1, 3, 5]\n",
    "[1]\n",
    "[1, 4]\n",
    "改变模数重新划分",
)
add(
    5,
    3,
    "Hasse 覆盖边删除自反和中间传递边",
    "有限偏序的覆盖关系 a<b 要求没有 c 满足 a<c<b。此处原始偏序已给为整除，不能把任意有向图直接称为偏序。",
    "mit-relations",
    "domain=[1,2,4] if n == 1 else [1,2,3]\nless=lambda a,b:a != b and b % a == 0\nedges=[(a,b) for a in domain for b in domain if less(a,b)]\nprint(edges)",
    "if less(a,b)]",
    "if less(a,b) and not any(less(a,c) and less(c,b) for c in domain)]",
    "[(1, 2), (1, 4), (2, 4)]\n",
    "[(1, 2), (2, 4)]\n",
    "[(1, 2), (1, 3)]\n",
    "[(1, 2), (1, 3)]\n",
    "不可比较的两个上方元素",
)

add(
    3,
    1,
    "偶数和的整数见证",
    "若 x=2a、y=2b 则 x+y=2(a+b)，见证必须是整数。此处计算一个具体见证，完整直接证明须另提交任意整数的推导。",
    "mit-proof",
    "a,b=(2,3) if n == 1 else (-2,1)\nx,y=2*a,2*b\nwitness=a*b\nprint(x+y == 2*witness)",
    "witness=a*b",
    "witness=a+b",
    "False\n",
    "True\n",
    "False\n",
    "True\n",
    "负整数见证",
)
add(
    3,
    2,
    "逆否不能交换成逆命题",
    "逆否 p→q 对应 ¬q→¬p；反证须先明确要否定的结论。有限赋值观察不能替代一般证明正文。",
    "mit-proof",
    "p,q=(False,True) if n == 1 else (True,False)\nprint((not q) or p)",
    "(not q) or p",
    "q or (not p)",
    "False\n",
    "True\n",
    "True\n",
    "False\n",
    "反例方向改变",
)
add(
    3,
    3,
    "归纳求和先核对基例及步的候选式",
    "1 至 k 的和为 k(k+1)/2；从 k 到 k+1 加 k+1。有限数值检查可以发现候选公式错误，但不能认证任意 k 的归纳步。",
    "mit-proof",
    "k=4 if n == 1 else 0\nprint(k*(k-1)//2)",
    "k*(k-1)//2",
    "k*(k+1)//2",
    "6\n",
    "10\n",
    "0\n",
    "0\n",
    "零起点基例",
)
add(
    6,
    1,
    "重复字母排列应去除重计",
    "相同字母不可区分时，不同索引排列可能对应同一作品；除法规则需要每个作品有相同数量的原像。这里实际枚举小词去重。",
    "mit-count",
    "from itertools import permutations\nword='AAB' if n == 1 else 'AAA'\nrows=list(permutations(word))\nprint(len(rows))",
    "len(rows)",
    "len(set(rows))",
    "6\n",
    "3\n",
    "6\n",
    "1\n",
    "全部字母相同",
)
add(
    6,
    2,
    "两个集合并集扣除一次交集",
    "|A∪B|=|A|+|B|-|A∩B|，重叠元素不能重复计算；本活动未覆盖一般鸽巢或多集合容斥证明。",
    "mit-count",
    "a={1,2}; b={2,3} if n == 1 else {3,4}\nprint(len(a)+len(b))",
    "len(a)+len(b)",
    "len(a)+len(b)-len(a & b)",
    "4\n",
    "3\n",
    "4\n",
    "4\n",
    "不交集合",
)
add(
    6,
    3,
    "禁止相邻一的计数需要两个前态",
    "长度 k 的二进制串禁止相邻 1，按末位分解得 F(k)=F(k-1)+F(k-2)，基例 F(0)=1、F(1)=2。须解释末位分类的不交与完备。",
    "mit-count",
    "k=4 if n == 1 else 1\na,b=1,2\nfor _ in range(2,k+1): a,b=b,b+1\nprint(a if k == 0 else b)",
    "a,b=b,b+1",
    "a,b=b,a+b",
    "5\n",
    "8\n",
    "2\n",
    "2\n",
    "长度一边界",
)
add(
    7,
    1,
    "封闭性要求所有运算结果在集合内",
    "运算 G×G→G 须对全部有序对有定义且封闭；存在一个封闭对不足以接受。此例加法未取模，用来发现出界。",
    "milne-group",
    "g={0,1} if n == 1 else {0}\nprint(any(a+b in g for a in g for b in g))",
    "any(a+b in g",
    "all(a+b in g",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "只含零的集合",
)
add(
    7,
    2,
    "乘法逆元不能把零算入候选群",
    "模 m 非零元素要成为乘法群须每个元素有逆且封闭等。此活动仅检查逆元条件；模四的二无逆，模五的非零元素均有逆，不由此单项认证环或域。",
    "milne-group",
    "m=4 if n == 1 else 5\ng=list(range(1,m))\nprint(any(all((a*b)%m != 1 for b in g) for a in g))",
    "any(all((a*b)%m != 1 for b in g) for a in g)",
    "all(any((a*b)%m == 1 for b in g) for a in g)",
    "True\n",
    "False\n",
    "False\n",
    "True\n",
    "模五非零元素",
)
add(
    7,
    3,
    "同态必须保持指定运算",
    "加法模 m 上 h(a+b)=h(a)+h(b) 按模 m 相等；h(x)=2x 可保持加法，而平移 x+1 不行。穷举本有限结构全部有序对。",
    "milne-group",
    "m=4 if n == 1 else 5\nh=lambda x:(x+1)%m\nprint(all(h((a+b)%m) == (h(a)+h(b))%m for a in range(m) for b in range(m)))",
    "(x+1)%m",
    "(2*x)%m",
    "False\n",
    "True\n",
    "False\n",
    "True\n",
    "改变结构模数",
)
add(
    8,
    1,
    "异或与或在同真输入不同",
    "异或表示恰一为真，布尔或表示至少一为真。题面指定真值契约，不混用位运算与集合运算。",
    "mit-logic",
    "p,q=(True,True) if n == 1 else (True,False)\nprint(p or q)",
    "p or q",
    "p != q",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "恰一为真",
)
add(
    8,
    2,
    "德摩根化简逐行保持真值",
    "¬(p∧q)=¬p∨¬q；错误地保留合取会改变真值。接受等价作品，不要求唯一文本表示。",
    "mit-logic",
    "from itertools import product\nrows=list(product([False,True],repeat=2)) if n == 1 else [(True,False)]\nprint(all((not (p and q)) == ((not p) and (not q)) for p,q in rows))",
    "((not p) and (not q))",
    "((not p) or (not q))",
    "False\n",
    "True\n",
    "False\n",
    "True\n",
    "指定区分赋值",
)
add(
    8,
    3,
    "集合包含格的确界按偏序比较",
    "幂集按包含排序，交集为最大下界、并集为最小上界。这里只计算本幂集实例，不能由有限几个集合宣称任意偏序是格。",
    "mit-sets",
    "a={1,2}; b={2,3} if n == 1 else {1,2}\nprint(sorted(a | b))",
    "a | b",
    "a & b",
    "[1, 2, 3]\n",
    "[2]\n",
    "[1, 2]\n",
    "[1, 2]\n",
    "相同集合的最大下界",
)
add(
    9,
    1,
    "连通性必须包含声明的孤点",
    "从一顶点的可达集合需与完整顶点集合比较；只检查边中出现的顶点会遗漏孤点。此处无向图并允许单顶点。",
    "mit-graph",
    "vertices={0,1,2} if n == 1 else {0,1}\nedges=[(0,1)]\nseen={0}\nfor _ in vertices:\n for a,b in edges:\n  if a in seen: seen.add(b)\n  if b in seen: seen.add(a)\nprint(seen == {x for e in edges for x in e})",
    "seen == {x for e in edges for x in e}",
    "seen == vertices",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "去除孤点的图",
)
add(
    9,
    2,
    "Euler 回路还要检查非零度顶点连通",
    "无向图各非零度顶点连通且均偶度时存在 Euler 回路。两个分离三角形虽全偶度也不能一条回路走完；Hamilton 不能用此条件判定。",
    "levin-euler",
    "edges=[(0,1),(1,2),(2,0)]+([(3,4),(4,5),(5,3)] if n == 1 else [])\nvertices={x for e in edges for x in e}\ndegree={v:sum(v in e for e in edges) for v in vertices}\nseen={0}\nfor _ in vertices:\n for a,b in edges:\n  if a in seen: seen.add(b)\n  if b in seen: seen.add(a)\nprint(all(d % 2 == 0 for d in degree.values()))",
    "all(d % 2 == 0 for d in degree.values())",
    "seen == vertices and all(d % 2 == 0 for d in degree.values())",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "单一三角形",
)
add(
    9,
    3,
    "合法着色要求每条边端点异色",
    "检查给定着色作品不等于求色数或判定平面性；平面图边数界是必要条件，不能单独当充分条件。",
    "mit-graph",
    "edges=[(0,1),(1,2),(2,0)]\ncolors={0:0,1:1,2:0} if n == 1 else {0:0,1:1,2:2}\nprint(any(colors[a] != colors[b] for a,b in edges))",
    "any(colors[a] != colors[b]",
    "all(colors[a] != colors[b]",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "三色合法证书",
)
add(
    10,
    1,
    "树的边数条件须结合连通",
    "有限简单无向图是树当且仅当连通且边数为顶点数减一。孤点加三角形满足边数却不是树。",
    "mit-tree",
    "vertices={0,1,2,3}\nedges=[(0,1),(1,2),(2,0)] if n == 1 else [(0,1),(1,2),(2,3)]\nseen={0}\nfor _ in vertices:\n for a,b in edges:\n  if a in seen: seen.add(b)\n  if b in seen: seen.add(a)\nprint(len(edges) == len(vertices)-1)",
    "len(edges) == len(vertices)-1",
    "seen == vertices and len(edges) == len(vertices)-1",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "四顶点路径树",
)
add(
    10,
    2,
    "最小生成树挑边须拒绝环",
    "Kruskal 按权重加入连接不同分量的边，不能直接取最便宜的 n-1 条。不同同权最优树也应按可行性与总代价接受。",
    "mit-tree",
    "edges=[(1,0,1),(1,1,2),(1,0,2),(5,2,3)] if n == 1 else [(1,0,1),(2,1,2),(3,2,3)]\nparent=list(range(4))\ndef root(x):\n while parent[x] != x: x=parent[x]\n return x\ntotal=0; selected=0\nfor w,a,b in sorted(edges):\n if selected == 3: break\n if True:\n  total+=w; selected+=1; parent[root(a)]=root(b)\nprint(total)",
    "if True:",
    "if root(a) != root(b):",
    "3\n",
    "7\n",
    "6\n",
    "6\n",
    "无廉价环的图",
)
add(
    10,
    3,
    "课程先修约束遇环不能给出完整计划",
    "真实约束图先约定节点含义与边方向；Kahn 处理数小于全部节点时应报告环，而不是接受部分序列。此例尚未构成完整离散建模项目。",
    "mit-relations",
    "vertices=[0,1,2]; edges=[(0,1),(1,0)] if n == 1 else [(0,1),(1,2)]\ndegree={v:0 for v in vertices}\nfor a,b in edges: degree[b]+=1\nqueue=[v for v in vertices if degree[v] == 0]; count=0\nwhile queue:\n v=queue.pop(0); count+=1\n for a,b in edges:\n  if a == v:\n   degree[b]-=1\n   if degree[b] == 0: queue.append(b)\nprint('ok')",
    "print('ok')",
    "print('ok' if count == len(vertices) else 'cycle')",
    "ok\n",
    "cycle\n",
    "ok\n",
    "ok\n",
    "无环先修约束",
)

if __name__ == "__main__":
    book.package["relations"] = []
    connections = [
        ("M01-O01", "M01-O02", "mit-logic", "蕴涵真值行用于对照逆否与逆命题"),
        ("M01-O02", "M01-O03", "mit-logic", "等价失败的真值行给出反例赋值"),
        ("M02-O01", "M02-O03", "mit-logic", "逐人见证与共享见证改变量词顺序"),
        ("M02-O02", "M02-O03", "mit-logic", "否定与量词作用域共同决定反模型"),
        ("M03-O01", "M03-O03", "mit-proof", "整数见证的推导与归纳步均须说明任意参数"),
        ("M03-O02", "M03-O03", "mit-proof", "逻辑推导方向和归纳假设的使用均需单独论证"),
        ("M04-O01", "M04-O02", "mit-sets", "有限集合比较用于检查定义域和陪域"),
        ("M04-O02", "M04-O03", "mit-sets", "复合的中间像须落入外层函数定义域"),
        ("M05-O01", "M05-O02", "mit-relations", "等价类分割依赖等价关系三项性质"),
        ("M05-O01", "M05-O03", "mit-relations", "覆盖关系以给定偏序性质为前提"),
        ("M06-O01", "M06-O02", "mit-count", "去重与容斥都需说明重复计数次数"),
        ("M06-O02", "M06-O03", "mit-count", "末位分类计数须不交且覆盖所有合法作品"),
        ("M07-O01", "M07-O02", "milne-group", "逆元条件检查不能绕过运算的封闭契约"),
        ("M07-O02", "M07-O03", "milne-group", "同态指定两个结构及所保持的运算"),
        ("M08-O01", "M08-O02", "mit-logic", "布尔表达式化简保持全部真值行"),
        ("M08-O02", "M08-O03", "mit-sets", "布尔逻辑和集合包含格对应但对象类型不同"),
        ("M09-O01", "M09-O02", "levin-euler", "全偶度条件之外还需要非零度顶点连通"),
        ("M09-O01", "M09-O03", "mit-graph", "连通性与着色均须使用完整顶点边模型"),
        ("M10-O01", "M10-O02", "mit-tree", "生成树作品必须首先满足树的可行性"),
        ("M10-O01", "M10-O03", "mit-relations", "无向树和有向无环先修图约束不同"),
    ]
    for start, end, source, reason in connections:
        book.package["relations"].append(
            {
                "from": "CS05-" + start,
                "to": "CS05-" + end,
                "kind": "conceptual_association",
                "reason": reason,
                "source_locator": source,
                "course_version_id": book.version,
                "review_state": "authority_checked",
                "source": "原创教学工件关系："
                + reason
                + "；机制参见 "
                + source
                + "；专业审校不可用。",
            }
        )
    book.save("CS05-core")
