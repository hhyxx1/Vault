# 本轮综合任务关键主张登记

日期2026-10-10；作者工程核对，expert_review=unavailable。下列仅覆盖本轮新增任务关键结论，不代表366目标全部主张已登记。第三方资料仅事实核对及链接，不打包其正文或题解。定位均为实际读到的网页章节/段，不编造教材页码。

|claim_id / objective_id|statement 与 assumptions|source_id / locator / source_version / read_at|independent_check / test_ref|conflict / status|
|---|---|---|---|---|
|CPU-ENC / CS06-M05-O03|教学16位指令按opcode/dest/src/operand编码；8位加减模256；只适用于原创ISA|项目ISA / CS06-TEACHING-PROCESSOR.md「ISA与执行假设」/0.2.0 /2026-10-10|手算6条机器码及32个算术构造；test_cpu_project.py|无；exercise_validated；不能外推Hack/x86|
|CPU-WRITE / CS06-M06-O03|这一四阶段模型前三阶段不写架构寄存器；提交时写；非实物时序|项目ISA / 四阶段定义 /0.2.0 /2026-10-10|逐阶段断言及控制冲突拒绝；test_cpu_project.py|无；exercise_validated；完整电气/流水线待补|
|CPU-CACHE / CS06-M08-O02|直接映射写回缓存脏行冲突替换需写回；限定两行单字节|cornell-cache-project / [cache notes](https://www.cs.cornell.edu/courses/cs3410/2025fa/notes/caches.html)，映射与写策略 /2025fa /2026-10-10|独立已知访存序列及最终RAM核对；test_cpu_project.py|无；exercise_validated；仅单一大学依据加有限实现核对|
|FLOW-BOT / CS04-M06-O03|增广量是路径最小正残量；反向步减少对应已分配流|dal-flow-project / [Augment瓶颈段](https://web.cs.dal.ca/~nzeh/Teaching/4113/book/maxflow/augpath/ford_fulkerson/algorithm.html) /在线滚动，读取日期固定 /2026-10-10|六节点匹配反向撤销反例及50小图枚举源汇割；test_flow_project.py|无；exercise_validated；枚举不代替一般证明|
|FLOW-BFS / CS04-M06-O03|Edmonds-Karp使用残量网络BFS选最少边数路径|dal-ek-project / [算法首段](https://web.cs.dal.ca/~nzeh/Teaching/4113/book/maxflow/augpath/edmonds_karp.html) /在线滚动 /2026-10-10|实际路径与反向步工件；CS04-project.json|无；authority_checked + exercise_validated；相同大学页面不算独立双源|
|FLOW-CUT / CS04-M06-O03|可行流不超过任意源汇割容量；达到相同值的可行流与割构成该输入的最优证书|[Yale Aspnes MaxFlow](https://www.cs.yale.edu/homes/aspnes/pinewiki/MaxFlow.html)第3节，配合Dalhousie残量终止条件 /2003–2012课堂资料静态副本 /2026-10-10|独立枚举全部小图源汇割及守恒/容量；test_flow_project.py|表示方式已解释：Yale采用反对称净流，本实现逐原边非负流；旧站提示部分公式损坏，因此只交叉核对可读正文论证，不采用其排版公式或过时最快算法主张。该有限证书exercise_validated，开放一般证明仍待复核|
|ML-REG / CS13-M03-O01|LinearRegression拟合系数和截距；固定四点y=2x+1|ml17-linear_model / [Ordinary Least Squares](https://scikit-learn.org/1.7/modules/linear_model.html) /1.7.2 /2026-10-10|由目标函数手算查询[-3,0,3]→[-5,1,7]；CS13-libraries.json|无；exercise_validated；四点不能证明总体泛化|
|ML-RIDGE / CS13-M03-O03|Ridge平方误差加alpha乘系数平方；本例alpha10系数1/3、训练MSE50/27|ml17-linear_model / Ridge regression惩罚公式 /1.7.2 /2026-10-10|独立解析式4/(2+alpha)与已知残差平方平均；CS13-libraries.json|无；exercise_validated；训练误差升高不能单独推出泛化优劣|
|ML-NONLINEAR / CS13-M05-O01;M06-O03;M08-O02|深度2树/RBF SVC/带tanh隐藏层MLP能在这四个异或点拟合；不是总体准确率|ml17-tree;ml17-svm;ml17-neural_networks_supervised / 1.7对应算法定义及限制 /1.7.2 /2026-10-10|异或标签真值表与实际模型输出逐项核对；CS13-libraries.json|无；exercise_validated；独立测试数据与调参流程待补|
|ML-CLUSTER / CS13-M07-O01|KMeans inertia为到所属质心平方距离和；本四点两簇1，一簇201|ml17-clustering / [K-means inertia](https://scikit-learn.org/1.7/modules/clustering.html) /1.7.2 /2026-10-10|手算质心[0,.5]/[10,10.5]及单质心[5,5.5]；排序消除标签歧义；CS13-libraries.json|无；exercise_validated；不是仅用inertia选择最佳簇数|
|ML-PCA / CS13-M07-O02|三共线点中心化秩1，一主成分保留全方差并重构|ml17-decomposition / [PCA与重构](https://scikit-learn.org/1.7/modules/decomposition.html) /1.7.2 /2026-10-10|独立秩与重构零误差计算；不固定向量符号；CS13-libraries.json|无；exercise_validated；不能推广为所有数据无损降维|

每条来源核对还需要中文术语、完整替代方案和适用边界的长期复核。源码/课程快照发生变化应重新定位这些主张，不通过更换日期自动续期。当前缺少专业审校资源、一般性开放论证的可靠审阅及真实模型质量验证，仍保持待复核。
