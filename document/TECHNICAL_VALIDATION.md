# 技术选型验证记录

版本：v1.3

更新日期：2026 年 10 月 6 日；第1–6节保留之前验证的历史范围。

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

2026年10月3日，在 `C:\Project\Vault` 的 `hyx_dev` 上复跑当时源文件。前面1–4节保留选型阶段的原型／只读历史观察。本次没有连接或改变旧服务器，没有使用真实学习数据／供应商模型凭据。

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

## 7 账号与跨设备同步开发切片（2026 年 10 月 6 日）

本节是在上述首个学习切片基础上的增量记录。认证回归用合成账号与独立 PG18 测试库，邮件仅保存于私有 TEMP 捕获目录；没有真实邮箱投递、学生学习数据、模型 API 或旧服务器部署。

| 检查 | 实际结果 | 边界 |
|---|---|---|
| 后端 | 最终 `pytest` 88 项通过，其中 47 项使用真实 PostgreSQL；Ruff check／format、Alembic metadata 零差异 | 覆盖开发认证、归属、严格同步、回执、冲突和迁移，不等于上线安全／容量门全部通过 |
| PostgreSQL 迁移 | 新数据库 base→head；既有版本升级；downgrade→head；各阶段 `alembic check` 零差异 | 仅任务隔离的 PG18.1 disposable／development DB；个人试用数据库单独创建 |
| OpenAPI／类型 | 从实际 API 导出 OpenAPI `--check` 通过；前端生成 TypeScript `contracts:check` 通过 | 合同检查不替代全功能验收 |
| Web | TypeScript `typecheck`、23 项 Vitest、Vite production build 通过 | 构建只证明当前客户端可打包 |
| 浏览器 | Playwright 26 项通过：桌面 Chromium 与 Pixel 7 移动模拟；包含学习旧场景与真实账号切片 | 测试运行于 Windows Chrome；不是 iOS Safari、Linux CI 或真实教学验收 |
| 学生／教师账号 | 注册、邮箱确认、登录、教师待审核、学生独立空间、密码重置并撤销旧 session；私有草稿不会分享学生 | 邮件为本机捕获，并未发到真实邮箱；教师认证仍未建立人工审核台 |
| 归属与恢复 | 已承接作品记录、确认逐项同步、跨设备恢复本人空间、丢失 claim 响应后原账号恢复；切 B 后 B 的记录不出现 A 的原件 | 附件不支持；软件更新/设备损坏不代表有生产备份恢复 |
| 竞态与证据信任 | 打开的学习页拉取另一设备新稿后立即可见；编辑中的陈旧版本不能覆盖；延迟空间切换遇账号改变被取消。恢复核验作为待复核历史，不写入平台可信事件或图谱达标 | 当前仅覆盖已实现的目标／版本数据类型与浏览器切换用例 |
| CI | [Linux GitHub Actions 三个 job 成功](https://github.com/hhyxx1/Vault/actions/runs/37460277148)，验证提交 e74353c | 此结果针对该提交；后续代码变更需查看对应 Actions；不以 Windows 通过代替 Linux CI |

真实多设备使用通过独立 Playwright 浏览器上下文模拟，而非两台实际设备。接口和数据库不能替代教师关联授权、课程分享、附件、生产邮件、离线重开应用壳与备份灾备验收。账号与数据删除入口尚未完整交付。测试数据为合成数据，没有学习效果或课程掌握率结论。

重现命令与隔离测试库保护要求见 [开发运行说明](DEVELOPMENT_GUIDE.md)。前端页面范围、八维子集复核和截图见 [品质记录](FRONTEND_QUALITY_REVIEW.md)；实际路径和生产禁止边界见 [账号同步实现](ACCOUNT_SYNC_IMPLEMENTATION.md)。

## 9 CS03 学习助手开发切片

2026 年 10 月 6 日在 CS03 栈工程样例实现默认关闭的 LangGraph 意图路由、DeepSeek Responses API 结构化网关和学习帮助记录。实现范围、数据边界及未验证项见 [学习助手实现切片](LEARNING_ASSIST_IMPLEMENTATION.md)。

本机验证使用假模型，不访问 DeepSeek：后端 47 项通过、48 项跳过（47 项需隔离 PostgreSQL；LangGraph 路由测试因当前离线缓存缺少 `langsmith` 未执行）；Ruff 通过。前端生产构建、23 项 Vitest 和契约检查通过；桌面与移动 Chrome 的 26 项 E2E 通过，含按次同意、Agent 答复刷新恢复、返回当前作品、修改后刷新仍可恢复，且成功提示不遮挡作品。真实账号邮箱 E2E 因未设置 `VAULT_E2E_MAIL_CAPTURE_DIR` 未执行。真实模型调用、响应质量、实际费用和生产隐私配置均未验证；CI 会按 `uv.lock` 安装 LangGraph 依赖并执行路由测试。

## 10 PostgreSQL checkpoint 架构验证

2026 年 10 月 6 日加入锁定依赖 `langgraph-checkpoint-postgres==3.1.2`，使用 [PG 检查点探针](technical_validation/langgraph_postgres_probe.py) 在本机 PostgreSQL 18 的**新建可销毁数据库**及独立 `agent_checkpoint` schema 中运行。两个独立 Python 进程先后执行 `prepare` 和 `resume`：两个合成运行都停在等待学生输入；重启进程后只恢复 A，B 仍等待；恢复结果只产生待复核建议，不写学习证据。测试后删除该探针数据库。探针 state 只保存 owner、活动和作品修订的合成引用，启用严格 msgpack 反序列化；不含学生正文或模型请求。CI 后端 job 也在独立可销毁数据库重复这组验证。

上述结果只证明 LangGraph 1.2.12／PG checkpointer 3.1.2 在当前 Python 3.13 和 PG18 环境可持久化、跨进程恢复及隔离两个 thread。**尚未**接入账号 Agent API、权威 owner／空间／版本／撤权复核、业务幂等与预算账本，也未验证取消竞态、负载、真实模型或生产迁移。访客 Agent 仍不得使用永久 PG checkpoint；此探针不能作为账号工作流已完成的证明。
