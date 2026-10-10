# CS02 Java借阅综合实验

2026-10-10；CS02-core-practice-0.2.0；M08-O03活动@0.2.0。两个任务的桌面/手机4项实际闭环通过。

Main.java驱动真实Java21编译执行，Library.java实现封装的馆藏/借阅集合、不可变record、库存计算、所属人归还、重复归还拒绝。学生预测错误归还和库存状态，修改Library.java，再用两个不同借阅者检查状态与记录是否互相影响。

真正写UTF8版本化文本、原子移动替换，创建全新Library对象读取文件，核对未归还/已归还库存和借阅ID。解析拒绝未知版本、坏行、重复ID、悬空图书、负库存和不合法计数；不使用Java对象反序列化。单线程领域模型，不提供网络身份认证或并发数据库。

100份新版本作者工件真实Linux isolate编译/运行核对；另有独立Java领域场景实际通过，检查库存耗尽、错误归还、重载、重复归还、单调ID和损坏文件。文件原子替换不意味着已验证断电耐久/跨文件系统，也不保留跨沙箱文件。浏览器实际核对错误归还反例、修复重跑、代码/结果刷新恢复和图谱仍为0/24掌握、当前目标部分条件满足。组合成功不自动认证其他目标。

实际查阅[Java21 records](https://docs.oracle.com/en/java/javase/21/language/records.html)、[Files](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/Files.html)、[ATOMIC_MOVE](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/StandardCopyOption.html)正文。这里record组件只有不可变String/基本类型，不能推断任意含可变组件record深度不可变。实现与数据原创。

完整Java课程仍需GUI/网络/线程等规定深度、独立测试和开放解释，整课仍未完成Q0–Q5。
