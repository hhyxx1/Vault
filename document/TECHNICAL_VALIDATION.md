# 技术选型验证记录

版本：v1.0

日期：2026 年 10 月 3 日

本记录区分官方研究、小型原型与完整集成。选定技术见 [技术基线](TECHNOLOGY_BASELINE.md)；选型不代表集成／发布验收通过。

## 1 LangGraph 小型原型

环境：Windows x86_64、隔离 TEMP venv、CPython 3.12.14；langgraph 1.2.12、langgraph-checkpoint 4.2.0、langgraph-checkpoint-sqlite 3.1.1。安装与 pip check 成功；未修改系统 Python，没有模型调用、生产数据库或真实学习记录。

代码：[langgraph_probe.py](technical_validation/langgraph_probe.py)。只包含等待学生与生成待核验建议两个节点，SQLite 临时检查点；prepare、resume 在两个 Python 进程依次运行，输入为虚构 student-a／student-b、task-a／task-b。

| 检查 | 结果 | 证明范围 |
|---|---|---|
| 无学生回复暂停 | 通过 | interrupt 产生待输入，未提前生成建议 |
| 两个独立 run 待输入 | 通过 | 本样例两个 thread_id 状态分开 |
| prepare 结束后 resume | 通过 | SQLite 检查点由下一进程恢复 |
| A 恢复、B 仍等待 | 通过 | 恢复 A 没有改变 B；不是并发压力测试 |
| 输出只作为建议 | 通过 | needs_real_verification 字符串，没有证据／掌握写入 |
| 错 owner／撤权／取消拒绝 | 夹具检查通过 | 本地字典／集合网关；不是生产 ACL、撤权竞态或异步工具终止 |
| Python3.13 Linux 全依赖 | 未测 | 与本轮解释器和 OS 不同 |
| PG checkpointer／迁移 | 未测 | 本轮只用 SQLite |
| SSE／多worker／工具取消回收 | 未测 | 待真实 API、队列、工具联调 |
| 来源授权／受控答案／quota事务 | 未测 | 待业务 PG 和 B03–B06 |

复现：新建临时 Python3.12 venv，将 $probePython 指向其 python.exe，$probeDb 指向不存在的临时 SQLite 路径，第二步沿用同一文件。不要提交生成数据库或替代生产 PG。

```powershell
& $probePython -m pip install langgraph==1.2.12 langgraph-checkpoint==4.2.0 langgraph-checkpoint-sqlite==3.1.1
& $probePython -m pip check
& $probePython document/technical_validation/langgraph_probe.py prepare $probeDb
& $probePython document/technical_validation/langgraph_probe.py resume $probeDb
```

首次重跑换新数据库，无需 API 密钥。生产通过受限恢复网关校验输入，不能执行浏览器提供的任意 checkpoint／工具指令。

## 2 本机只读观察

| 项目 | 观察 | 限制 |
|---|---|---|
| Node | 22.20.0，npm10.9.3 | 未安装前端依赖或构建 |
| Python | 系统命令3.11.9；隔离原型3.12.14 | 文件夹名不证明解释器版本，业务3.13待配置 |
| Docker CLI | 29.5.3 | Engine 未运行，未建新容器 |
| 新版工程 | 尚未建立 | 没有迁移、正式OpenAPI、锁文件、页面或CI结果 |

## 3 现有服务器只读观察

用户此前授权的 SSH 目标经已知主机密钥验证，仅查 OS／CPU／内存／磁盘／Docker 摘要。未重启、部署、改配置或读取业务正文；凭据和认证文件不入 Git。

| 项目 | 本次观察 |
|---|---|
| OS／架构 | Linux6.8.0-90-generic，x86_64 |
| CPU | 2 个逻辑 CPU |
| 内存 | OS 可见约1613MiB，可用约1060MiB；不是云合同规格 |
| swap | 约4095MiB，使用约520MiB |
| 根盘 | df -h：40G，总使用约29G，可用约8.3G，78% |
| Docker server | 29.4.3；旧frontend、backend、db仍运行 |

瞬时观察没有负载、IOPS／网络或峰值测试。不能以该宿主证明新 PG＋API＋OCR／embedding＋学生实验合并部署可行；独立新环境和测试初值见 [部署](DEPLOYMENT.md)。未采购或实际验证。

## 4 文档核查与实施门

交叉评审修正访客短期协议、SSE刷新恢复、claim响应丢失、长流会话撤销和离线范围；它们是设计修正，运行测试未完成。本轮28份Markdown本地链接／表格检查通过，PRD仍46项（43 P0／3 P1），FR01–FR46均有RTM条目；原型按将提交的脚本路径复跑通过。提交前另跑git diff --check，结果以提交输出为准。

后端B01–B06、前端实际浏览器与八维品质、执行隔离、13门课程、部署恢复均待测。首个工程提交产生锁文件／镜像和PG／前端smoke，纵切后产生权限、同步、真实核验报告。没有学习效果、模型对照或成本数据。
