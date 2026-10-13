# 数据结构 0.6.0 来源与知识图谱核对

课程版本：CS03-core-practice-0.6.0（f50b5979-1083-5ee7-b700-d5cd1360684d）。

这份记录核对当前发布包中的来源映射、知识图谱端点和活动范围。来源查阅与作者交叉核对不等于学科专家审签；没有把任何状态写成“专业审校通过”。

## 本次增补的课程范围

| 目标 | 新增目标 | 核心核对点 | 主来源 |
| --- | --- | --- | --- |
| CS03-M02-O04 在有序顺序表上实现二分查找 | 有序数组前提、半开区间、首个重复位置、未命中与对数代价 | [OpenDSA: Search in Sorted Arrays](https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all/fall-2019/Public_Instance/html/SortedSearch.html)，22.3: sorted-array search, binary-search interval halving and logarithmic cost |
| CS03-M04-O04 实现 Boyer–Moore 字符串匹配 | 坏字符与好后缀位移、重叠匹配、最坏情况边界 | [OpenDSA: Boyer–Moore String Search](https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all-0013bb43-a12f-4ab3-9b86-73b317f1e37e/fall-2017/Oct7_Test/html/StringSearchBoyerMoore.html)，33.6: right-to-left comparisons and bad-character alignment; cross-checked against course core outcome |
| CS03-M07-O05 实现 Prim 最小生成森林 | 按分量扩展、过期边跳过、等权替代、最小生成森林 | [OpenDSA CS3: Minimal Cost Spanning Trees](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/MCST.html)，14.6: Prim expansion by minimum edge crossing the current tree boundary |
| CS03-M08-O04 实现 Floyd–Warshall 全点对最短路 | 中间点动态规划、不可达处理、负边与负环 | [OpenDSA CSci 2101: All-Pairs Shortest Paths](https://opendsa-server.cs.vt.edu/ODSA/Books/CSCI2101/html/Floyd.html)，9.8: k-path dynamic-programming recurrence, cubic time and distance matrix |
| CS03-M09-O05 实现带墓碑的二次探查 | 素数容量 11 的有限探查覆盖、墓碑、半载条件 | [OpenDSA CS3: Improved Collision Resolution](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/HashCImproved.html)，10.7.3: quadratic probe sequence coverage and prime-table/less-than-half-load guarantee |
| CS03-M10-O05 实现稳定的有界整数桶排序 | 有界整数键域、同键稳定性、桶排序与基数排序区别 | [OpenDSA: Binsort](https://opendsa-server.cs.vt.edu/ODSA/Books/Everything/html/BinSort.html)，13.13: direct bins for key values; distinction from range-based bucket sort |

六项主题同时列入 ACM/IEEE-CS/AAAI CS2023 AL-A 核心范围映射；具体教学合同仍按本项目有限输入协议定义。

## 来源清单

| ID | 来源及链接 | 核对定位 | 状态 |
| --- | --- | --- | --- |
| mit6006-sequences | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) | pp.1–4: sequence/set interfaces, arrays, linked lists, amortized cost | authority_checked |
| odsa-hash-delete | [OpenDSA Deletion in Open Addressing](https://opendsax.cs.vt.edu/ODSA/StandaloneModules/20250507145027/html/HashDel.html) | Deletion: tombstones and continued search | authority_checked |
| cpp17-draft | [WG21 N4659 C++17 working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) | 8.6 [expr.mul] p.131: integral quotient and remainder | authority_checked |
| cornell-kmp | [Cornell CS312 String Search](https://www.cs.cornell.edu/courses/cs312/2002fa/lectures/lec26.htm) | Knuth-Morris-Pratt Algorithm; prefix convention | authority_checked |
| scipy-coo | [SciPy COO sparse representation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.coo_matrix.html) | Notes: duplicate coordinates; construction | authority_checked |
| mit-trees | [MIT 6.006 Binary Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/376714cc85c6c784d90eec9c575ec027_MIT6_006S20_lec6.pdf) | pp.1–6: traversal, subtree operations, search trees | authority_checked |
| mit-avl | [MIT 6.006 AVL Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/a2c80596cf4a2b5fbc854afdd2f23dcb_MIT6_006S20_lec7.pdf) | rotation and balancing | authority_checked |
| odsa-huffman | [OpenDSA Huffman Coding Trees](https://opendsax.cs.vt.edu/ODSA/Books/CS3/html/Huffman.html) | 7.18.1.1 building and assigning codes | authority_checked |
| cmu-bplus | [CMU 15-445 Tree Indexes](https://15445.courses.cs.cmu.edu/fall2022/notes/08-trees.pdf) | pp.1–2: leaf and internal node split differ | authority_checked |
| mit-bfs | [MIT 6.006 Breadth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/196a95604877d326c6586e60477b59d4_MIT6_006S20_lec9.pdf) | representations and BFS | authority_checked |
| mit-dfs | [MIT 6.006 Depth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/f3e349e0eb3288592289d2c81e0c4f4d_MIT6_006S20_lec10.pdf) | full graph search and topological order | authority_checked |
| mit-dijkstra | [MIT 6.006 Dijkstra](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/d819e7f4568aced8d5b59e03db6c7b67_MIT6_006S20_lec13.pdf) | pp.1–2: nonnegative weights and relaxation | authority_checked |
| gordon-cpm | [Gordon College Graphs and Networks](https://www.math-cs.gordon.edu/courses/cs321/lectures/graphs.html) | AOE critical path analysis; earliest/latest event times | authority_checked |
| mit-hash | [MIT 6.006 Hashing](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ce9e94705b914598ce78a00a70a1f734_MIT6_006S20_lec4.pdf) | hash functions, collisions and load | authority_checked |
| mit-sort | [MIT 6.006 Sorting](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/6d1ae5278d02bbecb5c4428928b24194_MIT6_006S20_lec3.pdf) | sorting permutation, insertion and merge | authority_checked |
| odsa-external | [OpenDSA External Sorting](https://opendsax.cs.vt.edu/ODSA/Books/CS3/html/ExternalSort.html) | 9.6 sorted runs and merging | authority_checked |
| ods-singly-20261013 | [Open Data Structures: Singly-Linked List](https://opendatastructures.org/ods-cpp/3_1_Singly_Linked_List.html) | 3.1 and 3.1.1: head/tail and empty transitions | authority_checked |
| ods-doubly-20261013 | [Open Data Structures: Doubly-Linked List](https://opendatastructures.org/ods-cpp/3_2_Doubly_Linked_List.html) | 3.2 and 3.2.1: sentinel and bidirectional updates | authority_checked |
| cmu-mst-20261013 | [Carl Kingsford / UMD CMSC451 Minimum Spanning Trees](https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/mst.pdf) | Minimum spanning trees, Kruskal and cut property | authority_checked |
| mit-bellman-20261013 | [MIT 6.006 Bellman-Ford](https://www.ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/5edb13fb34cbe7f4cdccc13d131772e7_MIT6_006F11_lec17.pdf) | Bellman-Ford relaxation and reachable negative cycle detection | authority_checked |
| ods-sort-20261013 | [Open Data Structures: Comparison-Based Sorting](https://opendatastructures.org/ods-cpp/11_1_Comparison_Based_Sorti.html) | 11.1: merge-sort, randomized quicksort and heap-sort; teaching quicksort is deterministic | authority_checked |
| ods-priority-queue | [OpenDSA CS3: Heaps and Priority Queues](https://opendsa-server.cs.vt.edu/ODSA/Books/CS3/html/Heaps.html) | 7.17: complete-tree heap representation, priority-queue operations, insertion and removal | authority_checked |
| cs2023-alcore | [ACM/IEEE-CS/AAAI CS2023: AL CS Core](https://csed.acm.org/al-cs-core/) | AL-A items 2, 5, 6, 12 and 13: binary search; Prim/Kruskal/Floyd; quadratic probing; Boyer–Moore; bucket/radix sorting | authority_checked |
| ods-open-hashing | [OpenDSA CS3: Open Hashing / Separate Chaining](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/OpenHash.html) | 10.4.1: collision resolution by per-bucket linked lists; average cost depends on distribution | authority_checked |
| ods-union-find-20261013 | [OpenDSA CS3: Union/Find and the Parent Pointer Implementation](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/UnionFind.html) | 13.2.1: parent-pointer representation, weighted union, path compression, amortized behavior | authority_checked |
| odsa-radix-sort-20261013 | [OpenDSA CS3: Radix Sort](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/RadixSort.html) | 8.14: stable digit passes, counting distribution, key-width and base assumptions | authority_checked |
| ods-sorted-search-20261013 | [OpenDSA: Search in Sorted Arrays](https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all/fall-2019/Public_Instance/html/SortedSearch.html) | 22.3: sorted-array search, binary-search interval halving and logarithmic cost | authority_checked |
| ods-boyer-moore-20261013 | [OpenDSA: Boyer–Moore String Search](https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all-0013bb43-a12f-4ab3-9b86-73b317f1e37e/fall-2017/Oct7_Test/html/StringSearchBoyerMoore.html) | 33.6: right-to-left comparisons and bad-character alignment; cross-checked against course core outcome | authority_checked |
| ods-prim-mcst-20261013 | [OpenDSA CS3: Minimal Cost Spanning Trees](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/MCST.html) | 14.6: Prim expansion by minimum edge crossing the current tree boundary | authority_checked |
| ods-floyd-20261013 | [OpenDSA CSci 2101: All-Pairs Shortest Paths](https://opendsa-server.cs.vt.edu/ODSA/Books/CSCI2101/html/Floyd.html) | 9.8: k-path dynamic-programming recurrence, cubic time and distance matrix | authority_checked |
| ods-quadratic-probing-20261013 | [OpenDSA CS3: Improved Collision Resolution](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/HashCImproved.html) | 10.7.3: quadratic probe sequence coverage and prime-table/less-than-half-load guarantee | authority_checked |
| ods-binsort-20261013 | [OpenDSA: Binsort](https://opendsa-server.cs.vt.edu/ODSA/Books/Everything/html/BinSort.html) | 13.13: direct bins for key values; distinction from range-based bucket sort | authority_checked |

## 图谱完整性

- 目标节点：41；课程活动：41；关系边：36；来源记录：32。
- 边类型：application 18 条，conceptual_association 18 条。
- 41 个目标均至少连接一条关系；端点全部存在，关系来源 ID 全部可解析，关系三元组无重复。
- 图谱边表达知识联系或推荐路径，不代表掌握结论。没有关系不表示不会；证据状态由学习记录单独计算。

### 全部关系边

| 起点 | 终点 | 类型 | 教学理由 | 来源 |
| --- | --- | --- | --- | --- |
| CS03-M01-O01 描述抽象操作契约 | CS03-M01-O02 区分逻辑与存储结构 | conceptual_association | 契约与存储表示是两个不同层次。 | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) |
| CS03-M01-O02 区分逻辑与存储结构 | CS03-M02-O01 实现顺序表插删 | application | 连续存储对应顺序表元素搬移。 | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) |
| CS03-M01-O03 计数基本操作 | CS03-M10-O01 实现内部排序 | application | 比较与搬移计数用于分析内部排序代价。 | [MIT 6.006 Sorting](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/6d1ae5278d02bbecb5c4428928b24194_MIT6_006S20_lec3.pdf) |
| CS03-M02-O02 实现单链表操作 | CS03-M02-O03 处理循环和双向链接 | conceptual_association | 单向和双向链接分别检查后继与前驱。 | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) |
| CS03-M02-O02 实现单链表操作 | CS03-M03-O02 实现循环及链式队列 | application | 单链节点首尾链接用于链式队列的入队与出队。 | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) |
| CS03-M03-O01 推演栈状态和边界 | CS03-M03-O03 用栈解决括号匹配 | application | 后进先出结构用于记录未闭合括号。 | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) |
| CS03-M03-O02 实现循环及链式队列 | CS03-M07-O02 实现 DFS/BFS | application | 先进先出队列用于 BFS 逐层推进。 | [MIT 6.006 Breadth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/196a95604877d326c6586e60477b59d4_MIT6_006S20_lec9.pdf) |
| CS03-M04-O01 实现字符串匹配 | CS03-M04-O02 推导 KMP 前缀信息 | conceptual_association | 朴素匹配与前缀回退处理同一匹配接口。 | [Cornell CS312 String Search](https://www.cs.cornell.edu/courses/cs312/2002fa/lectures/lec26.htm) |
| CS03-M04-O03 表示稀疏矩阵和广义表 | CS03-M07-O01 建立邻接表示 | conceptual_association | 稀疏坐标与邻接表示都需要定义未存项的语义。 | [MIT 6.006 Breadth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/196a95604877d326c6586e60477b59d4_MIT6_006S20_lec9.pdf) |
| CS03-M05-O01 转换树的表示 | CS03-M05-O02 实现递归及迭代遍历 | application | 遍历应用于节点链接表示。 | [MIT 6.006 Binary Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/376714cc85c6c784d90eec9c575ec027_MIT6_006S20_lec6.pdf) |
| CS03-M05-O02 实现递归及迭代遍历 | CS03-M06-O01 实现二叉搜索树 | conceptual_association | 中序有序性用于检查搜索树；遍历不是唯一查找实现，未设严格先修。 | [MIT 6.006 Binary Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/376714cc85c6c784d90eec9c575ec027_MIT6_006S20_lec6.pdf) |
| CS03-M05-O03 构建 Huffman 编码 | CS03-M05-O01 转换树的表示 | application | Huffman 合并产物可以表示为带权二叉树。 | [OpenDSA Huffman Coding Trees](https://opendsax.cs.vt.edu/ODSA/Books/CS3/html/Huffman.html) |
| CS03-M06-O01 实现二叉搜索树 | CS03-M06-O02 维护平衡约束 | application | 旋转须保持搜索树有序性与子树内容。 | [MIT 6.006 AVL Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/a2c80596cf4a2b5fbc854afdd2f23dcb_MIT6_006S20_lec7.pdf) |
| CS03-M06-O03 解释 B/B+ 树查找与更新 | CS03-M10-O03 解释外部排序及结构选型 | conceptual_association | 页容量与外部存储访问影响索引及排序选择。 | [CMU 15-445 Tree Indexes](https://15445.courses.cs.cmu.edu/fall2022/notes/08-trees.pdf) |
| CS03-M07-O02 实现 DFS/BFS | CS03-M07-O03 分析连通及生成树 | application | 重复启动搜索用于覆盖各连通分量。 | [MIT 6.006 Depth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/f3e349e0eb3288592289d2c81e0c4f4d_MIT6_006S20_lec10.pdf) |
| CS03-M07-O02 实现 DFS/BFS | CS03-M08-O01 实现最短路 | conceptual_association | 无权逐层距离与带权最短路的适用条件不同。 | [MIT 6.006 Dijkstra](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/d819e7f4568aced8d5b59e03db6c7b67_MIT6_006S20_lec13.pdf) |
| CS03-M07-O02 实现 DFS/BFS | CS03-M08-O02 完成拓扑排序 | application | 图遍历可用于拓扑排序，但不是唯一实现。 | [MIT 6.006 Depth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/f3e349e0eb3288592289d2c81e0c4f4d_MIT6_006S20_lec10.pdf) |
| CS03-M08-O02 完成拓扑排序 | CS03-M08-O03 处理关键路径与适用前提 | application | 拓扑次序用于 DAG 事件时间的递推。 | [Gordon College Graphs and Networks](https://www.math-cs.gordon.edu/courses/cs321/lectures/graphs.html) |
| CS03-M09-O01 实现散列查找 | CS03-M09-O02 处理冲突和删除 | application | 同槽冲突需要定义完整探查与删除状态语义。 | [MIT 6.006 Hashing](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ce9e94705b914598ce78a00a70a1f734_MIT6_006S20_lec4.pdf) |
| CS03-M09-O02 处理冲突和删除 | CS03-M09-O03 分析装载率影响 | conceptual_association | 装载率和删除状态共同影响探查工作量。 | [MIT 6.006 Hashing](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ce9e94705b914598ce78a00a70a1f734_MIT6_006S20_lec4.pdf) |
| CS03-M10-O01 实现内部排序 | CS03-M10-O02 比较稳定性和复杂度 | application | 排序移动规则决定同键稳定性。 | [MIT 6.006 Sorting](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/6d1ae5278d02bbecb5c4428928b24194_MIT6_006S20_lec3.pdf) |
| CS03-M10-O01 实现内部排序 | CS03-M10-O03 解释外部排序及结构选型 | application | 内部排序生成有序段用于外部归并。 | [OpenDSA External Sorting](https://opendsax.cs.vt.edu/ODSA/Books/CS3/html/ExternalSort.html) |
| CS03-M03-O04 实现堆式优先队列 | CS03-M05-O03 构建 Huffman 编码 | application | Huffman 构造反复取出权重最小的两棵树；优先队列可支持这一贪心步骤。 | [OpenDSA CS3: Heaps and Priority Queues](https://opendsa-server.cs.vt.edu/ODSA/Books/CS3/html/Heaps.html) |
| CS03-M03-O04 实现堆式优先队列 | CS03-M10-O01 实现内部排序 | conceptual_association | 堆排序和优先队列都可使用完全二叉堆的不变量，但堆排序是排序算法，不等同于优先队列接口。 | [OpenDSA CS3: Heaps and Priority Queues](https://opendsa-server.cs.vt.edu/ODSA/Books/CS3/html/Heaps.html) |
| CS03-M03-O05 实现固定容量循环双端队列 | CS03-M03-O02 实现循环及链式队列 | conceptual_association | 双端队列允许两端插入和删除；将操作限制在队尾插入、队首删除即可得到 FIFO 队列行为。 | [ACM/IEEE-CS/AAAI CS2023: AL CS Core](https://csed.acm.org/al-cs-core/) |
| CS03-M09-O04 比较开放定址与分离链接 | CS03-M09-O01 实现散列查找 | conceptual_association | 分离链接把冲突键放入同一桶的链表，开放定址则继续探查表内槽位；两者是不同冲突解决策略。 | [OpenDSA CS3: Open Hashing / Separate Chaining](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/OpenHash.html) |
| CS03-M07-O04 实现并查集与路径压缩 | CS03-M07-O03 分析连通及生成树 | application | Kruskal 逐边检查两个端点是否已连通，并在接受边后合并集合；并查集支持这个循环。 | [OpenDSA CS3: Union/Find and the Parent Pointer Implementation](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/UnionFind.html) |
| CS03-M07-O04 实现并查集与路径压缩 | CS03-M07-O02 实现 DFS/BFS | conceptual_association | 并查集合并回答增量连通查询；BFS/DFS 从图遍历求连通结构，两者可服务不同查询模式。 | [OpenDSA CS3: Union/Find and the Parent Pointer Implementation](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/UnionFind.html) |
| CS03-M10-O04 实现稳定的无符号整数基数排序 | CS03-M10-O02 比较稳定性和复杂度 | conceptual_association | 基数排序靠键的数字表示和稳定分配工作，不受比较排序下界约束；键域与键宽决定适用条件。 | [OpenDSA CS3: Radix Sort](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/RadixSort.html) |
| CS03-M10-O01 实现内部排序 | CS03-M10-O04 实现稳定的无符号整数基数排序 | conceptual_association | 比较排序使用元素比较建立次序；固定宽度整数基数排序利用 digit 分配，前提和复杂度模型不同。 | [ACM/IEEE-CS/AAAI CS2023: AL CS Core](https://csed.acm.org/al-cs-core/) |
| CS03-M02-O04 在有序顺序表上实现二分查找 | CS03-M02-O01 实现顺序表插删 | application | 顺序表提供可随机访问的已排序数组表示；二分查找依赖该存储特性。 | [OpenDSA: Search in Sorted Arrays](https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all/fall-2019/Public_Instance/html/SortedSearch.html) |
| CS03-M04-O04 实现 Boyer–Moore 字符串匹配 | CS03-M04-O02 推导 KMP 前缀信息 | conceptual_association | KMP 与 Boyer–Moore 都是精确字符串匹配算法，但使用不同的失配信息和扫描方向。 | [OpenDSA: Boyer–Moore String Search](https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all-0013bb43-a12f-4ab3-9b86-73b317f1e37e/fall-2017/Oct7_Test/html/StringSearchBoyerMoore.html) |
| CS03-M07-O05 实现 Prim 最小生成森林 | CS03-M07-O03 分析连通及生成树 | conceptual_association | Kruskal 与 Prim 都构造最小生成树/森林，但采用全图边排序与分量前沿扩展两种策略。 | [OpenDSA CS3: Minimal Cost Spanning Trees](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/MCST.html) |
| CS03-M08-O04 实现 Floyd–Warshall 全点对最短路 | CS03-M08-O01 实现最短路 | conceptual_association | Floyd–Warshall 扩展为全点对动态规划，单源 Dijkstra/Bellman–Ford 采用不同边权前提。 | [OpenDSA CSci 2101: All-Pairs Shortest Paths](https://opendsa-server.cs.vt.edu/ODSA/Books/CSCI2101/html/Floyd.html) |
| CS03-M09-O05 实现带墓碑的二次探查 | CS03-M09-O02 处理冲突和删除 | application | 墓碑删除规则沿用开放定址查找的探查链语义；二次探查改变槽位序列，不改变三态区分。 | [OpenDSA CS3: Improved Collision Resolution](https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/HashCImproved.html) |
| CS03-M10-O05 实现稳定的有界整数桶排序 | CS03-M10-O04 实现稳定的无符号整数基数排序 | conceptual_association | 直接桶按完整有界键分配一次；LSD 基数排序按多个 digit 重复进行稳定分配。 | [OpenDSA: Binsort](https://opendsa-server.cs.vt.edu/ODSA/Books/Everything/html/BinSort.html) |

## 尚需外部验收的边界

- authority_checked 表示作者查阅公开课程材料并核对目标映射，不表示同行评审或学科教师签字。
- 课程包和自动检查器覆盖明示输入，不证明对任意输入的普遍正确性，也不验证学生能否独立迁移。
- 图谱关系完整性只证明数据端点和来源记录完整；真实学习者的路线理解、移动端可用性和课程难度仍需使用者测试。
- Q4 学科审校和 Q5 生产发布尚未通过，保持未验收状态。
