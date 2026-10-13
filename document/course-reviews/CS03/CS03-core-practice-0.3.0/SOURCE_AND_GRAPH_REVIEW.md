# 数据结构来源与图谱关系核对

来源访问与正文核对属于技术编写核对，不是专业审校签字；原创任务是对明确概念的教学实现，不照搬来源整章。

| 来源 | 定位 | 链接 | 状态 |
| --- | --- | --- | --- |
| mit6006-sequences | pp.1–4: sequence/set interfaces, arrays, linked lists, amortized cost | [MIT 6.006 Spring 2020 Lecture 2: Data Structures](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf) | authority_checked |
| odsa-hash-delete | Deletion: tombstones and continued search | [OpenDSA Deletion in Open Addressing](https://opendsax.cs.vt.edu/ODSA/StandaloneModules/20250507145027/html/HashDel.html) | authority_checked |
| cpp17-draft | 8.6 [expr.mul] p.131: integral quotient and remainder | [WG21 N4659 C++17 working draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf) | authority_checked |
| cornell-kmp | Knuth-Morris-Pratt Algorithm; prefix convention | [Cornell CS312 String Search](https://www.cs.cornell.edu/courses/cs312/2002fa/lectures/lec26.htm) | authority_checked |
| scipy-coo | Notes: duplicate coordinates; construction | [SciPy COO sparse representation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.coo_matrix.html) | authority_checked |
| mit-trees | pp.1–6: traversal, subtree operations, search trees | [MIT 6.006 Binary Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/376714cc85c6c784d90eec9c575ec027_MIT6_006S20_lec6.pdf) | authority_checked |
| mit-avl | rotation and balancing | [MIT 6.006 AVL Trees](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/a2c80596cf4a2b5fbc854afdd2f23dcb_MIT6_006S20_lec7.pdf) | authority_checked |
| odsa-huffman | 7.18.1.1 building and assigning codes | [OpenDSA Huffman Coding Trees](https://opendsax.cs.vt.edu/ODSA/Books/CS3/html/Huffman.html) | authority_checked |
| cmu-bplus | pp.1–2: leaf and internal node split differ | [CMU 15-445 Tree Indexes](https://15445.courses.cs.cmu.edu/fall2022/notes/08-trees.pdf) | authority_checked |
| mit-bfs | representations and BFS | [MIT 6.006 Breadth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/196a95604877d326c6586e60477b59d4_MIT6_006S20_lec9.pdf) | authority_checked |
| mit-dfs | full graph search and topological order | [MIT 6.006 Depth-First Search](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/f3e349e0eb3288592289d2c81e0c4f4d_MIT6_006S20_lec10.pdf) | authority_checked |
| mit-dijkstra | pp.1–2: nonnegative weights and relaxation | [MIT 6.006 Dijkstra](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/d819e7f4568aced8d5b59e03db6c7b67_MIT6_006S20_lec13.pdf) | authority_checked |
| gordon-cpm | AOE critical path analysis; earliest/latest event times | [Gordon College Graphs and Networks](https://www.math-cs.gordon.edu/courses/cs321/lectures/graphs.html) | authority_checked |
| mit-hash | hash functions, collisions and load | [MIT 6.006 Hashing](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ce9e94705b914598ce78a00a70a1f734_MIT6_006S20_lec4.pdf) | authority_checked |
| mit-sort | sorting permutation, insertion and merge | [MIT 6.006 Sorting](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/6d1ae5278d02bbecb5c4428928b24194_MIT6_006S20_lec3.pdf) | authority_checked |
| odsa-external | 9.6 sorted runs and merging | [OpenDSA External Sorting](https://opendsax.cs.vt.edu/ODSA/Books/CS3/html/ExternalSort.html) | authority_checked |
| ods-singly-20261013 | 3.1 and 3.1.1: head/tail and empty transitions | [Open Data Structures: Singly-Linked List](https://opendatastructures.org/ods-cpp/3_1_Singly_Linked_List.html) | authority_checked |
| ods-doubly-20261013 | 3.2 and 3.2.1: sentinel and bidirectional updates | [Open Data Structures: Doubly-Linked List](https://opendatastructures.org/ods-cpp/3_2_Doubly_Linked_List.html) | authority_checked |
| cmu-mst-20261013 | Minimum spanning trees, Kruskal and cut property | [Carl Kingsford / UMD CMSC451 Minimum Spanning Trees](https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/mst.pdf) | authority_checked |
| mit-bellman-20261013 | Bellman-Ford relaxation and reachable negative cycle detection | [MIT 6.006 Bellman-Ford](https://www.ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/5edb13fb34cbe7f4cdccc13d131772e7_MIT6_006F11_lec17.pdf) | authority_checked |
| ods-sort-20261013 | 11.1: merge-sort, randomized quicksort and heap-sort; teaching quicksort is deterministic | [Open Data Structures: Comparison-Based Sorting](https://opendatastructures.org/ods-cpp/11_1_Comparison_Based_Sorti.html) | authority_checked |

## 关系逐项核对

| 起点 | 终点 | 类型 | 理由 | 来源 |
| --- | --- | --- | --- | --- |
| CS03-M01-O01 | CS03-M01-O02 | conceptual_association | 契约与存储表示是两个不同层次。 | mit6006-sequences |
| CS03-M01-O02 | CS03-M02-O01 | application | 连续存储对应顺序表元素搬移。 | mit6006-sequences |
| CS03-M01-O03 | CS03-M10-O01 | application | 比较与搬移计数用于分析内部排序代价。 | mit-sort |
| CS03-M02-O02 | CS03-M02-O03 | conceptual_association | 单向和双向链接分别检查后继与前驱。 | mit6006-sequences |
| CS03-M02-O02 | CS03-M03-O02 | application | 单链节点首尾链接用于链式队列的入队与出队。 | mit6006-sequences |
| CS03-M03-O01 | CS03-M03-O03 | application | 后进先出结构用于记录未闭合括号。 | mit6006-sequences |
| CS03-M03-O02 | CS03-M07-O02 | application | 先进先出队列用于 BFS 逐层推进。 | mit-bfs |
| CS03-M04-O01 | CS03-M04-O02 | conceptual_association | 朴素匹配与前缀回退处理同一匹配接口。 | cornell-kmp |
| CS03-M04-O03 | CS03-M07-O01 | conceptual_association | 稀疏坐标与邻接表示都需要定义未存项的语义。 | mit-bfs |
| CS03-M05-O01 | CS03-M05-O02 | application | 遍历应用于节点链接表示。 | mit-trees |
| CS03-M05-O02 | CS03-M06-O01 | conceptual_association | 中序有序性用于检查搜索树；遍历不是唯一查找实现，未设严格先修。 | mit-trees |
| CS03-M05-O03 | CS03-M05-O01 | application | Huffman 合并产物可以表示为带权二叉树。 | odsa-huffman |
| CS03-M06-O01 | CS03-M06-O02 | application | 旋转须保持搜索树有序性与子树内容。 | mit-avl |
| CS03-M06-O03 | CS03-M10-O03 | conceptual_association | 页容量与外部存储访问影响索引及排序选择。 | cmu-bplus |
| CS03-M07-O02 | CS03-M07-O03 | application | 重复启动搜索用于覆盖各连通分量。 | mit-dfs |
| CS03-M07-O02 | CS03-M08-O01 | conceptual_association | 无权逐层距离与带权最短路的适用条件不同。 | mit-dijkstra |
| CS03-M07-O02 | CS03-M08-O02 | application | 图遍历可用于拓扑排序，但不是唯一实现。 | mit-dfs |
| CS03-M08-O02 | CS03-M08-O03 | application | 拓扑次序用于 DAG 事件时间的递推。 | gordon-cpm |
| CS03-M09-O01 | CS03-M09-O02 | application | 同槽冲突需要定义完整探查与删除状态语义。 | mit-hash |
| CS03-M09-O02 | CS03-M09-O03 | conceptual_association | 装载率和删除状态共同影响探查工作量。 | mit-hash |
| CS03-M10-O01 | CS03-M10-O02 | application | 排序移动规则决定同键稳定性。 | mit-sort |
| CS03-M10-O01 | CS03-M10-O03 | application | 内部排序生成有序段用于外部归并。 | odsa-external |

关系是教学路线推荐或概念联系，不是学生掌握结论。专业审阅仍 unavailable，不把 authority_checked 写成 expert_reviewed。
