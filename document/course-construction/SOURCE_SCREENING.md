# 网络资料筛选、主张核对与勘误

查阅日期：2026-10-09。本轮完成下列公开入口／目录的初筛，部分规范正文可读取；尚未完成 366 个目标的逐条知识核对。表中“可用入口”不等于可以直接发布课程正文。

## 1 来源登记

| ID | 第一方来源和访问入口 | 本轮查阅范围、用途和限制 |
| --- | --- | --- |
| S01 | [Harvard CS50x](https://cs50.harvard.edu/x/) | 课程首页与主题目录；用于 C 入门顺序查漏，不当作完整 C 语言规范；页面为滚动版本 |
| S02 | [Dev.java](https://dev.java/learn/) | 官方学习目录；对象、泛型、集合等；示例可能使用高于 Java21 的特性，须筛选 |
| S03 | [Java21 JLS](https://docs.oracle.com/javase/specs/jls/se21/html/index.html) | 指定版本语言规范目录；按声明、类型、表达式等章节定位，具体规则尚待逐条读核 |
| S04 | [MIT 6.006 讲义目录](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/) | 已读主题目录：结构、散列、树、图、最短路及动态规划；不是完整数据结构课程的唯一来源 |
| S05 | [MIT 6.046J](https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/) | 课程入口；高级算法主题的候选补充，具体讲义待逐节读取 |
| S06 | [MIT 6.042J](https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/) | 课程范围页；逻辑、证明、集合、关系、图、计数；代数结构不能默认已覆盖 |
| S07 | [Nand2Tetris 项目目录](https://www.nand2tetris.org/course) | 已读硬件／软件项目范围；参考可操作步骤，不能覆盖浮点、缓存及流水线全部要求 |
| S08 | [MIT 6.004](https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/) | 课程入口；组成与系统结构候选依据，具体模型须与平台教学 ISA 分开 |
| S09 | [OSTEP 作者站](https://pages.cs.wisc.edu/~remzi/OSTEP/) | 已读书籍介绍与资源入口；虚拟化、并发和持久化；章节正文需继续定位 |
| S10 | [Kurose/Ross 作者课程资源](https://gaia.cs.umass.edu/kurose_ross/online_lectures.htm) | 已读章节目录；网络主题查漏。页面说明部分内容曾缺失，不能当全课完整资料 |
| S11 | [RFC9293](https://www.rfc-editor.org/rfc/rfc9293.html) | TCP 规范、目录与状态机等正文可读取；具体教学结论须落实到条款并查勘误，不推广到 UDP/QUIC |
| S12 | [CMU 15-445 Fall 2024](https://15445.courses.cs.cmu.edu/fall2024/) | 课程入口；数据库主题与工程活动参考，不能替代 SQL 方言规范 |
| S13 | [PostgreSQL18 文档](https://www.postgresql.org/docs/18/index.html) | 版本化目录；SQL、事务与权限行为按相应正文及实测确定，补丁版本另锁定 |
| S14 | [MIT 6.005](https://ocw.mit.edu/ans7870/6/6.005/s16/) | 软件构造课程入口；规格、测试、抽象等。需求工程及运维覆盖仍需其他来源 |
| S15 | [Cornell CS4120](https://www.cs.cornell.edu/courses/cs4120/2023sp/) | 已读课程概览、主题与资源；词法到代码生成。项目语言不能直接决定本项目实现语言 |
| S16 | [Berkeley CS188 教材](https://inst.eecs.berkeley.edu/~cs188/textbook/) | 教材入口与目录；搜索、推理等；每个算法前提仍需逐条核对 |
| S17 | [ISL 作者站](https://www.statlearning.com/) | 已读作者公开资源入口；统计学习范围参考，具体章节和许可待落实 |
| S18 | [scikit-learn 常见误区](https://scikit-learn.org/stable/common_pitfalls.html) | 已读预处理、泄漏和随机性相关正文；API 按将来锁定版本复核，stable 不作固定版本号 |
| S19 | [Python3.13 教程](https://docs.python.org/3.13/tutorial/) | 指定版本目录；语法及标准工具，不作为算法正确性证据 |
| S20 | [Artificial Intelligence: Foundations of Computational Agents 第3版作者站](https://artint.info/3e/html/ArtInt3e.html) | 已读目录：搜索、约束、推理、规划、学习等；具体正文待逐项读取。网页声明 CC BY-NC-ND 4.0，不默认允许商业课程改编或翻译打包；只作事实核对入口，材料使用另审许可 |

同一机构的课程、转载、镜像以及同一教材的不同网页不自动视为独立来源；语言官方规范可作为该语言行为的权威一手依据，另用实际测试检查我们自己的实现，而不是用运行一次“证明”规范。

## 2 未通过本轮访问的候选

OpenDSA 的旧 Everything 目录返回 404、主站本轮超时；Princeton Algorithms 入口返回 403；Systems Approach 入口读取失败；MIT 旧 PDF 直链读取失败，改用 S06 官方入口；SWEBOK 页面返回 403；Abstract Algebra: Theory and Applications 的尝试入口返回 502。GNU C 教程本轮读取超时；Open Textbook Library 中找到代数教材登记页，但尚未读到作者教材正文，不能作为已核对的技术依据。它们只记为待重新定位的候选，未进入已读依据，不因访问失败推断来源质量差或不存在。

当前须补核：C17 边界语义的规范依据；C++17 容器和生命周期；CS03 串／特殊存储、B/B+ 树与外排序；CS05 代数结构与格；CS06 浮点及详细时序；CS08 链路、IPv6、DNS/TLS；CS10 需求、维护及运维；各课中文术语。对应模块在台账标为“部分映射／补源”，不会被默认准入。

## 3 主张级准入流程

1. 将正文拆成可核对主张，例如“该算法在什么条件下保证最优”，不能只记一个整课首页。
2. 记录 `claim_id, objective_id, statement, assumptions, source_id, locator, source_version, read_at, independent_check, test_ref, conflict, status`。locator 必须是已实际读取的节／页／段，不编造页码。
3. 定义和一般结论对照独立教材／大学材料；协议和语言行为优先规范及勘误。若只能找到单一来源，写出原因和补核任务，不伪称交叉核对。
4. 题目、参考答案与检查器分别建立依据；运行正常、边界和故意错误样例。有限测试不能替代一般证明，开放设计允许多个合理解。
5. 中文表述复核量词、条件、否定、符号及术语；不机械翻译。例如平均、期望、最坏、摊还不能互换。
6. 冲突先区分版本、模型、定义、适用范围；无法解释时状态为 blocked，相关主张及依赖题目不开放。
7. 准入状态：candidate → located → cross_checked / authority_checked → exercise_validated → learning_ready。专业审校另存 `expert_review=unavailable`，不能由此流程自动改成已通过。

## 4 使用方式与维护

课程用中文原创组织讲解和题目，以来源为事实依据并提供引用；公开可读不等于可整页复制、改编或商用。导入前记录版权／许可与具体使用方式；权限未核清时仅保留来源链接，不把原件打包分发。

对可依法归档的内容记录版本及 hash；只保存引用的材料记录 URL、章节、访问日期和必要短摘录。每次发布前检查链接、版本和勘误；运行依赖升级时复核相关活动。发现错误后登记影响的目标、题目、标准和学生结论，撤回错误结论、重新计算并说明原因。
