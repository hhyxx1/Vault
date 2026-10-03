# 技术选型验证记录

版本：v1.1

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

## 5 首个实际工程切片（开发阶段追加）

2026年10月3日，在 `C:\Project\Vault` 的 `hyx_dev` 上复跑最终源文件。前面1–4节保留选型阶段的原型／只读历史观察。本次没有连接或改变旧服务器，没有使用真实学习数据／供应商模型凭据。

| 检查 | 实际结果与边界 |
|---|---|
| 运行时 | Node24.19.0、CPython3.13.16、npm、uv0.12.22；独立本机PG18.1；现有Chrome154 headless |
| 后端 | 49项pytest通过，其中11项真实PG：互斥profile、跨空间／作品／父版本FK、无ctx和跨owner RLS拒绝、连接池ctx不残留、claim owner、版本冻结及双连接发布竞争、访客正文不写永久表 |
| 租约／核验 | HTTP／领域测试覆盖Origin／POSTnonce、凭据隔离、TTL、请求大小／严格字段、幂等／丢失响应、等待输入、取消／确认清理、SSE恢复与连接上限、确定性执行和不假报mastery |
| 迁移 | 实际库 upgrade→downgrade→upgrade、alembic check零差异，随后恢复非superuser／非bypass运行角色表授权。仅针对本任务创建的可销毁库 |
| Python代码与契约 | Ruff check／format通过；FastAPI实际导出OpenAPI的check通过；前端生成类型的check通过 |
| Web | Node24安装锁、TypeScript typecheck、13项Vitest（解析／证据准入与版本投影／本地事务）、Vite生产构建通过 |
| 浏览器 | 24项Playwright通过，桌面／Pixel7配置使用本机真实Chrome，API8000真实checker；无模拟成功输出。覆盖目标、答案披露、保存／刷新、SPA离开、迟到结果、取消、断网、同幂等重试、篡改hash、存储失败恢复、键盘图谱、减少动效、CSS200%放大与六页面1440／390／320溢出检查 |
| 截图与独立审阅 | 主执行者另测1440／768／390／320，20页面截图无整体横向溢出或pageerror；独立审阅者实际走查桌面／390／320、成功／错误／编辑旧结论。八维修正与材料见前端记录 |
| Compose | PG18／pgvector0.8.7固定amd64manifest经DockerCLI核对，compose config --quiet通过；Engine未启、没有容器／向量或Linux全栈运行证明 |
| CI | 三job定义：真实PG后端／Web构建／浏览器；远端实际结果以Actions运行记录为准，不用本机Windows通过替代Linux通过 |

这些检查验证一个固定栈活动和工程数据边界。RLS基线测试不等于完成账号会话／教师授权／受控资料／同步安全；编辑器不等于隔离编译。LangGraph／模型质量、检索、所有课程和运营容量仍未验证。完整第一阶段13门范围与PRD46项保持不变。

复现步骤见 [开发运行说明](DEVELOPMENT_GUIDE.md)。PG测试须同时设置两个独立URL与 `VAULT_TEST_DATABASE_IS_DISPOSABLE=1`，否则跳过不能算通过。当前所有试验记录为合成技术测试，没有个人课程实测或统计效果。

## 6 实际命令启动与Linux CI补充

首个提交 `fc6d4ce` 的GitHub Actions三job均成功：[真实运行记录](https://github.com/hhyxx1/Vault/actions/runs/37162518249)。该记录覆盖初版的LinuxPG／迁移、Web构建与Chromium浏览器测试；随后追加的命令启动修正需要对应的新commit回归，不能以旧运行替代。

最后的Windows实际API ready检查发现：当前Uvicorn使用自己的loop factory，忽略旧的WindowsSelectorEventLoopPolicy，导致已配置PG仍503。入口改用显式自定义工厂，Windows创建Selector实例，Linux沿用Uvicorn自动工厂。增加第11项真实PG检查：启动 `python -m vault_backend` 独立进程，通过回环HTTP等待数据库ready，退出并清理自己的测试进程。最终本机49项pytest／Ruff全过；此项覆盖命令启动，避免仅靠ASGI夹具或独立psycopg测试漏检。
