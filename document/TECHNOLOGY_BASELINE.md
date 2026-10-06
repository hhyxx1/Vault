# 技术选型与工程基线

版本：v1.1

日期：2026 年 10 月 3 日

状态：经项目发起人“你来帮我确定”授权，选定为新版第一阶段开发基线。技术选择已确定；工程、Linux 依赖组合、迁移、隔离、容量及发布验收分别按实现阶段完成。本文不代表新系统已经实现或部署。

## 1 采用的整体方案

采用浏览器优先、前后端分离的模块化单体。同一业务代码库管理课程、目标、作品、证据、账号、授权、同步、Agent 和 Skill；API 与异步 worker 可独立运行。资料解析、学生代码、SQL 和网络实验通过窄接口连接独立执行环境。初期不拆业务微服务、不引入 Kubernetes，不把执行环境与业务数据库放到同一宿主内核。

这个结构便于一个较小开发团队贯通学习闭环，同时保留将高资源服务独立扩容的边界。13 门默认课程、自建课程、教师端、多 Agent、多 Skill 与完整证据闭环均保留；先完成一个工程切片不改变第一阶段全课程交付要求。

| 层 | 确定方案 | 在本项目中的职责 |
|---|---|---|
| Web | React 19.3、TypeScript 6.0、Vite 8.3、React Router 7 Data Mode | 学生／教师共享原创交互基础，学习工作区长期编辑和状态恢复；SPA 同源部署 |
| UI | Tailwind 4、自有 CSS 设计令牌、Radix Primitives、CSS＋Motion 13.4 | 基础交互与原创视觉；实施和八维品质复核是另一个交付门 |
| 图谱与编辑 | Cytoscape.js 3.34、CodeMirror 6、Tiptap 3 开源核心、Markdown＋KaTeX | 图谱浏览／基础编辑及等价树视图；代码／结构化作品与教学内容编辑 |
| 浏览器数据 | Dexie 4.4／IndexedDB、TanStack Query 5、Zustand 5 | 本地事务持久化／同步 outbox；远端可丢弃缓存；少量 UI 状态，三者不混为学习档案 |
| 业务后端 | CPython 3.13 标准 GIL、FastAPI、Pydantic 2、SQLAlchemy 2、psycopg 3、Alembic | 类型化 API、事务和物理迁移；uv 管理 Python 依赖，uv.lock 锁定 |
| 账号 | 自托管邮箱／密码、Argon2id、不透明 PostgreSQL session | 两类互斥账号；Cookie 会话、CSRF、撤销、教师核实与最小授权 |
| 权威存储 | PostgreSQL 18＋pgvector 0.8；正式附件使用私有 OSS | 业务、证据、ACL、同步、任务和账号检查点；文件以不可变版本引用管理 |
| 异步 | Celery 5＋Valkey 8；PG outbox／租约／幂等账本 | 至少一次投递；权威任务事实与额度记录在 PG，取消、重投和迟到结果可对账 |
| Agent | 自托管 Python LangGraph；模型网关使用 httpx 适配供应商 | 四项学习职责＋按需设计职责，按条件交接、等待学生及恢复；不采用外部托管编排 |
| 默认生成模型 | DeepSeek 的 deepseek-flash；高级模型自动切换关闭 | 第一家供应商适配器，全职责按需调用；没有真实调用、质量或成本测试结果 |
| 资料／检索 | Docling、受控 LibreOffice 转换、python-pptx／OOXML 检查；BAAI/bge-m3 dense 1024＋jieba 分词／PG GIN | 本地 CPU 解析和向量；学生副本及当前授权先过滤，小授权集先精确检索再融合 |
| 真实执行 | 原生 isolate 专用 Linux VM；SQL 独立临时 PG18；containerlab＋Linux／FRR 网络 VM | 真实编译／运行、数据库和协议实验；公开网络实验每租约独立 VM |
| 发布 | Linux、Docker Compose、Caddy 2；pgBackRest 独立备份 repository | 受信业务部署、HTTPS、备份恢复与回滚；不承诺已有服务器能运行整套方案 |
| 验证 | pytest／Hypothesis、Vitest 5／RTL、Playwright 1 | 领域与接口、事务／权限／故障、真实浏览器闭环；独立教研与视觉审核另行完成 |

表中选定维护线；没有明确主版本的包在首个 Linux 构建选正式维护版本。精确补丁、传递依赖、镜像 digest 和模型 revision 在通过兼容性原型后锁定，不以 latest 或 GitHub main 发布。前端／CI Node 统一 24 LTS；学生语言环境单独有 runtime manifest，不随业务升级改写旧证据。

细化设计：[前端实现](FRONTEND_IMPLEMENTATION.md)、[后端／物理数据／API](TECHNICAL_DATA_CONTRACT.md)、[部署与执行](DEPLOYMENT.md)、[ADR](ARCHITECTURE_DECISIONS.md)。

## 2 模型与 Agent 的确定边界

第一家接入选 DeepSeek 原生 HTTP Responses API，默认 deepseek-flash。官方当前将其指向 V4.1-Flash；供应商别名可能升级，记录请求 model、响应实际 model、供应商适配器版本和本项目 model_profile 版本。不能把可变别名冒充不可变权重快照。模型发生变化后跑相同课程／权限／工具回归，再接受新 profile。[官方更新](https://api-docs.deepseek.com/updates/)

网关自行管理历史和结构化输出，不把 SDK 的接口兼容当作行为完全一致。DeepSeek 该接口为无状态，developer 消息按 user 处理，因此可信平台规则映射 system，学生材料和检索片段明确作为不可信输入。工具调用只经平台允许列表和 Pydantic 校验；供应商不取得任意 shell、数据库写权限或发布能力。接口文档对响应／对话不存储的描述不能推导供应商零日志或零保留承诺，外部处理条款在公开试用前核对。[官方 API 契约](https://api-docs.deepseek.com/api/create-response/)

四项职责为规划与诊断、解释与辅导、实践任务、核验与反馈；课程与 Skill 设计按需执行。职责和 Skill 版本分别固定，不要求每轮唤起所有角色，也不需要用五个不同模型证明多 Agent。模型可提出活动或核验建议，工具事实、证据准入与发布许可由业务服务独立决定。

默认高级模型切换关闭。未来需要更强模型时通过另一个明确 profile 做质量／成本对照，不以错误重试自动升级或跨供应商发送私有资料。供应商凭据未配置时使用明确标注的模拟适配器做 UI／契约测试，界面不能将模拟输出当成真实辅导或学习证据。

开发初值：每个学生每次推进最多 6 次模型请求、8 次允许工具调用、模型输出合计最多 12000 token，活跃推进墙钟 180 秒；等待学生时释放 worker，不把等待计作持续模型执行。一个主体同时最多一个可变活动推进；初始 worker 全局模型并发为 2。额度、失败和取消以 PG 记录，接近上限停止并交回学生，不能静默循环。以上是原型保护初值，实际吞吐、延迟、单次成本和订阅额度尚未实测；调整须记录 profile 与回归结果。

账号模式的 LangGraph checkpoint 存在独立 PG schema／表组，只保存流程恢复所需引用和最少状态；不充当学习证据、ACL 或 quota 的权威账本。每次恢复校验 owner、空间、活动、图定义／Skill 版本和当前权限。访客等待状态返回浏览器，本地持久保存，下次提交已校验输入重新运行；短期guest lease使用独立不持久化服务，idle30min／absolute2h为开发初值，完成保存确认／取消／到期清理，不进入长期线程、PG/WAL、主broker AOF或备份。资料正文不默认写 checkpoint 或完整追踪日志。

本轮实际跑过 LangGraph 中断、跨进程 SQLite 恢复与两个流程隔离；owner／撤权／取消仅检查夹具网关。生产 PostgreSQL、Python 3.13、并发取消及工具回收仍待联调，详见 [验证记录](TECHNICAL_VALIDATION.md)。LangGraph 的恢复可能重新执行节点开头，外部动作和证据写入必须有业务幂等键。[中断语义](https://docs.langchain.com/oss/python/langgraph/interrupts)、[持久化](https://docs.langchain.com/oss/python/langgraph/persistence)

## 3 数据、检索与接口原则

1. PG18 是账号、当前授权、课程发布、作品／证据、同步和运行事实的唯一权威；Valkey、图谱投影、索引及浏览器远端缓存可重建。
2. 第一阶段一个账号一种基础类型，profile 分表并由复合约束匹配。教师 pending 可私人备课；平台人工核实为 verified 后可发布给学生。核实不授予学生记录访问权。
3. Dexie 每账号独立实例；未绑定访客空间领取后固定本人归属。发请求前原子claim journal固定本人／claim_id／origin／hash，响应丢失保持pending只本人恢复；归属确定与附件上传完成分别显示；op_id、版本、分支冲突及 tombstone 事务处理，客户端自报通过只能待复核。
4. `/api/v1` REST＋cookie＋CSRF；长任务采用fetch SSE，具有sequence／event_id／刷新显式Last-Event-ID恢复游标，终端独立 WS 票据。UUID 字符串、UTC、bigint 十进制字符串、If-Match 和 Idempotency-Key 统一。
5. 学生 RAG 必须以当前受众、课程发布、资料绑定、学生副本、生命周期与原答案策略确定授权集合，再召回／载入／发给模型／输出／回放。撤权先提交权威策略和 outbox，再清理索引；已发出的内容无法收回。
6. 首版 bge-m3 仅取 dense 1024，jieba 固定词典分词后生成 simple tsvector／GIN，用融合排序组合两路；不声称内置词法检索就是中文 BM25。模型或词典变化产生新 profile。先做授权集精确向量距离查询，ANN 以相关性、过滤召回与权限测试为启用门。
7. 教师私有原件及 PPT 未公开备注／隐藏页／附件不进入学生上下文。教师明确审阅的独立发布产物有自己的授权；受控答案谱系仍保留，不能靠改任务或去掉引用解禁。

首批字段类型、复合键、状态约束、端点及 OpenAPI 格式已落 [物理与 API 基线](TECHNICAL_DATA_CONTRACT.md)。完整 Alembic 迁移、FastAPI 生成 OpenAPI、TypeScript client 在实际工程中产生并测验，不将文档片段当成已执行 DDL。

## 4 工程组织与第一步实现

```text
apps/web/                 # React 应用
services/backend/         # API、领域服务、业务 worker、LangGraph 工作流
services/resource-worker/ # 受控解析与 embedding 调度／接口
services/execution/       # code、SQL、network 控制器及窄协议
content/courses/           # CS01–CS13 与公开模板的版本化课程包
packages/contracts/       # 由实现生成并审阅的接口／事件格式
infra/                    # Compose、镜像、受控部署配置与运行清单
document/                 # 所有项目说明与设计文档
```

这是工程建立时使用的结构，不表示这些目录已经存在。用户私人 Skill／课程／资料／学习记录保存在其数据空间，不能为了有目录把私人内容提交 Git。公开平台课程包使用审校和发布版本，JSON schema 与 provenance 随包管理。

实现先完成三个相互支撑的工作：

- 工程和 CI：锁定依赖，最小前后端、迁移与 API client，PG18／pgvector 连通；创建清晰的真实／模拟 adapter 分界。
- 一条可信纵切：课程目标→作品本地保存→实际运行／核验→追加证据→图谱更新→刷新恢复→本人登录承接；同时验证两个账号及私有资料拒绝路径。
- 原创体验与内容：关键页面高保真设计、八维复核；13 门全量课程蓝图与教研审校持续并行。纵切用样例不等于课程已完整。

按纵切结果补齐 PG checkpointer、多 Agent／Skill、不同活动 adapter、教师自建与资料发布／RAG。每个模块在实现前有精确数据迁移与接口 diff，发布前跑 [综合测试计划](TEST_PLAN.md)。不以建出静态页面作为学习闭环完成。

## 5 当前环境与实施门

本机已有 Node 22.20.0、Python 环境与 Docker CLI；Docker Engine 未运行。LangGraph 小型原型使用隔离 TEMP venv 的 Python 3.12.14，不是生产 Python 3.13 兼容证明。上述是选型时的历史观察。当前已使用 Node24.19.0／Python3.13.16 建立新版切片和依赖锁，并验证临时PG18.1与真实Chrome；Linux容器全栈构建和发布仍未验证，见 [技术记录](TECHNICAL_VALIDATION.md)。

旧服务器本轮只读观测为 2 逻辑 CPU、约 1.6 GiB OS 可见内存、根盘约 8.3 GiB 可用。新业务、CPU OCR／embedding 和实验不合并挤入该宿主；按独立新环境及分类型资源预算做原型。没有修改旧服务，也没有采购新节点。

已确定的选型可以直接用于建工程。依赖兼容、真实权限事务、同步恢复、执行隔离、中文检索质量、成本／容量、备份恢复和高品质前端仍需各自通过测验。收费金额、个人自测选课、域名、区域／bucket／凭据和精确保留时限是配置或发布事项，按 PRD D01／D06／D09 关闭，不能填作已具备资源。

## 6 主源与许可核对

设计阶段仅研究和小型 LangGraph 依赖验证；开发阶段新增原创工程代码，没有复制参考项目实现。前端许可见 [前端实现](FRONTEND_IMPLEMENTATION.md)；执行／资料依赖见 [部署设计](DEPLOYMENT.md)。建工程生成直接与传递依赖及模型／字体／镜像许可清单，保留需分发的声明。

- [Python 生命周期](https://devguide.python.org/versions/)、[uv 锁文件](https://docs.astral.sh/uv/concepts/projects/sync/)、[FastAPI](https://fastapi.tiangolo.com/)、[SQLAlchemy psycopg](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg)。
- [PG 维护策略](https://www.postgresql.org/support/versioning/)、[pgvector](https://github.com/pgvector/pgvector)、[BAAI 模型卡／MIT](https://huggingface.co/BAAI/bge-m3)。
- [LangGraph MIT](https://github.com/langchain-ai/langgraph/blob/main/LICENSE)、[Valkey BSD](https://github.com/valkey-io/valkey/blob/unstable/COPYING)、[Celery BSD](https://github.com/celery/celery/blob/main/LICENSE)、[Caddy Apache-2.0](https://github.com/caddyserver/caddy/blob/master/LICENSE)。
- [isolate GPL-2.0](https://github.com/ioi/isolate/blob/master/LICENSE)、[containerlab BSD](https://github.com/srl-labs/containerlab/blob/main/LICENSE)、[Docling MIT](https://github.com/docling-project/docling/blob/main/LICENSE)。服务调用边界不取消对实际修改／分发软件的许可义务；厂商镜像不随开源底座取得许可。

主源核对日为 2026 年 10 月 3 日；上游维护状态发生变化时复审对应 ADR。接受技术设计、集成通过、课程通过与允许发布是四个不同状态。

## 7 首个工程切片

当前工程锁定实际使用的依赖，库存见 [依赖记录](DEPENDENCY_INVENTORY.md)。React／FastAPI、公开课程包、设备作品、访客固定栈核验、图谱恢复、开发账号／claim／同步与PG迁移已经运行。LangGraph／模型、RAG／资料、隔离编译与全13门课程仍是后续范围。TypeScript 6 应用与 TypeScript 5 契约生成工具隔离的必要例外记入 ADR-0007；不降级应用，也不忽略 peer 检查。

PGvector 固定镜像已核对 manifest 并通过 Compose 配置解析；本机 Engine 未启动，未运行镜像／向量扩展测试。没有生产部署或真实学习效果数据。

## 8 账号与同步开发切片

2026 年 10 月 5 日在现有基线上实现 Argon2id／数据库 opaque session、邮箱确认与重置、CSRF、两类 profile、claim journal 与严格幂等同步；没有更换已选栈。实际迁移为0001–0003，前端使用 Dexie空间复合键，不再把“已选择工具”写作“完成产品”。详见 [当前实现](ACCOUNT_SYNC_IMPLEMENTATION.md)。生产投递、长期容量、教师授权、Agent／Skill、RAG与隔离执行仍按各自门推进。
