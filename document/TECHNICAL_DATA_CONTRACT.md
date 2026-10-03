# 后端、物理数据与 API 技术基线

版本：v1.0

更新日期：2026 年 10 月 3 日

状态：项目发起人已授权确定技术方案，本文件为选定的开发设计基线；不是已运行的系统、完整 SQL 迁移或验收报告。实施验证若暴露兼容、容量或安全问题，以 ADR 变更并保留依据，不继续将已选方案称为候选。

关联：[PRD](PRD.md)、[数据库概念模式](DATABASE_SCHEMA.md)、[API 逻辑契约](API_CONTRACT.md)、[资料与 RAG 权限](RAG_AND_RESOURCE_DESIGN.md)、[账号与同步](ACCOUNT_AND_DATA_DESIGN.md)。概念对象继续有效，本文件落实技术选择、首批物理约束和接口格式。

## 1 后端选型与运行边界

| 项目 | 选定方案 | 用途与边界 |
|---|---|---|
| 业务运行时 | CPython 3.13，标准 GIL 构建 | API、业务 Worker、Agent 编排；与学生代码的 Python runner 版本无绑定 |
| HTTP 服务 | FastAPI + Uvicorn，Pydantic 2 | 类型验证、OpenAPI 和 SSE；不使用 Pydantic 1 兼容层 |
| 数据访问 | SQLAlchemy 2 的 AsyncSession + psycopg 3 | `postgresql+psycopg`；每个请求／任务独立事务与 session，使用 SQLAlchemy 连接池，不叠加第二个驱动连接池 |
| 迁移 | Alembic | 每次物理模式变更必须有版本迁移、空库升级和旧模式升级验证；应用启动不能自动修改生产模式 |
| 权威数据库 | PostgreSQL 18 | 已登录账号、session、ACL、课程版本、账号学习证据、同步、job 和可靠事件的权威状态；访客运行负载按第 2.3 节独立临时处理 |
| 向量与词法 | pgvector 0.8 系列 + PostgreSQL GIN | 向量召回与明确中文分词后的词法召回融合；首版对授权集合精确距离检索，不另引入第二套权限数据库 |
| 默认 embedding | BAAI/bge-m3 dense，1024 维 | CPU 独立资料 Worker 批处理；权重 revision、tokenizer 和归一化参数进入构建 manifest，不在 API 请求进程临时下载权重 |
| 文件 | 正式交付使用阿里云 OSS 私有桶，业务后端授权代理；开发使用 FileBlobAdapter | DB 保存引用、hash、长度和生命周期，正文文件不塞入 JSON；下载不暴露长期可访问的 OSS 公共地址 |
| 浏览器传输 | `/api/v1` REST JSON + SSE | 命令、恢复和取消走 HTTP，生成／任务进度通过有游标的 SSE；交互式终端另用受限 WebSocket |

选择 3.13 是为了统一业务依赖并控制原生扩展联调量，不声称 3.14 不受支持。Python 官方生命周期、FastAPI 对 3.14 的支持记录和 psycopg 支持矩阵均可核对；3.12 不作为新业务默认，3.14 可在完整依赖构建测试后经 ADR 升级。课程 runtime 由执行服务独立声明。[Python 生命周期](https://devguide.python.org/versions/)、[FastAPI 发布记录](https://fastapi.tiangolo.com/release-notes/)、[psycopg 安装与平台矩阵](https://www.psycopg.org/psycopg3/docs/basic/install.html)。

PostgreSQL 18 已有官方维护周期，pgvector 官方支持 PostgreSQL 13 及以上；选型不等于本项目已验证扩展构建。精确 Python 补丁、FastAPI／Starlette／Pydantic 等依赖、pgvector 补丁和基础镜像 digest 在首个通过 CI 的锁文件中固定；部署使用经过该检查的固定版本，后续维护升级经过回归。[PostgreSQL 版本策略](https://www.postgresql.org/support/versioning/)、[pgvector 官方仓库](https://github.com/pgvector/pgvector)、[SQLAlchemy 的 psycopg 方言](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg)。

## 2 自托管账号与会话

### 2.1 身份和教师核实

- 一账号仅有 `student` 或 `teacher` 一种基础类型；界面不能用临时角色切换把学生转换为教师。公共请求无法授予管理员能力。
- 学生／教师 profile 分表，用带类型的复合外键保证匹配；教师可以拥有自己的个人学习空间，其教学空间与学生档案分别管理。
- 教师注册进入 `pending` 核实状态，可建立本人私有课程草稿、上传资料并备课；对学生发布课程／任务须为 `verified`。第一阶段核实采用平台管理者人工核对身份及教学用途，保存最少核实记录；拒绝、暂停和恢复均有审计。核实状态和账号类型是两个字段，不将注册选项等同于已核实。
- 权限仍按发布受众和学生授权判断：教师核实不授予读取任何学生个人空间的权利，也不授予他人资料的权利。
- 初始登录采用邮箱／密码，邮箱确认及密码重置令牌为一次性、有有效期、数据库只存摘要的能力令牌。邮件服务的具体供应商随部署配置，开发用非生产邮件捕获器；未接入真实邮件不能开放账号恢复入口。

### 2.2 密码和不透明 session

采用 Argon2id，初始参数 `m=65536 KiB, t=3, p=1`；生产机器实测登录延迟与并发内存后可上调，不低于当前 OWASP 建议最低强度。存标准编码 hash（含算法、参数和盐），成功登录时可重新 hash。登录限速与统一错误避免账号枚举，密码和令牌不进入日志。[密码存储依据](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。

生成 256 bit 随机不透明 session token，仅将 SHA-256 摘要存入 PostgreSQL；浏览器通过 `__Host-vault_session` cookie 携带原 token：`Secure; HttpOnly; SameSite=Lax; Path=/`，不设 Domain。生产仅 HTTPS、同站点 API，禁止放入 localStorage、URL 或 WebSocket 查询参数。开发 HTTP 另用明确命名的开发 cookie，生产构建禁止该配置。

初始默认会话空闲期限为 24 小时、绝对期限为 7 天；服务端取两者较早者，cookie 有效期不能扩大数据库期限。登录、密码重置或权限敏感变更轮换／撤销旧会话；退出立即标记数据库撤销，而非只删 cookie。最后活跃时间可每 5 分钟更新一次，但到期判断与撤销必须读取数据库权威值；Redis 或进程缓存不作为许可依据。这些数值是开发默认，尚未经过线上负载验证。[会话设计依据](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)。

已登录写操作同时检查同源 Origin 和绑定 session 的 CSRF token；包括退出、资料可见性、同步和 WebSocket ticket 签发。`GET /auth/csrf` 签发当前 session 的 CSRF token；未登录注册／登录使用独立短时预认证 nonce 及同源 Origin 检查，不能要求用户先有登录 session，nonce 不建立云端学习档案。CORS 不开放任意带凭据来源。SSE 只读，浏览器使用同源 cookie；活动运行仍由 POST 创建，SSE GET 不产生副作用。账号切换先停流与旧任务展示、清空内存查询缓存，再进入另一账号命名空间；本地归属记录不迁移。

### 2.3 访客 Agent、RAG 与运行的共同短期租约

未登录学习内容和证据只在本地持久保存，仍受浏览器清理／存储配额影响。在线AI／检索／执行采用统一 `guest_lease`，不创建云端account、永久learning_space、PG agent_run／PostgresSaver或永久job。平台公开内容可只读；租约不授予教师课程、需认证受众、教师私有资料／索引或未开放答案权限。

`POST /guest-leases` 在同源 Origin、模板／运行类型和匿名预算检查后签发 256 bit 随机凭据，仅在独立短期 GuestLeaseStore 存摘要。凭据由客户端内存或当前本地租约存储保存，后续请求以 `Authorization: GuestLease <token>` 发送；不放 URL、不混用已登录 cookie 的账号权限。租约包含随机 lease ID、允许的 operation 类型、公开课程／runtime 范围、配额、状态、空闲期限与绝对期限，不接受客户端指定账号或 teacher purpose。

开发初始期限：空闲 30 分钟、绝对 2 小时，按两者较早者截止。仅有心跳或状态轮询不延长空闲租期，有效用户输入／操作按规则更新；绝对期限不得续长。运行正文、短期资料切片、模型上下文、事件和 LangGraph 临时 checkpoint 放在独立无持久化 GuestLeaseStore／tmpfs 工作区：该实例关闭 AOF、RDB 和其他快照，排除备份；不能放入主 Valkey 的 AOF／备份、永久 PostgreSQL 表／WAL／备份、OSS 常规持久桶或永久追踪日志。公开平台资料索引保留在 PG，访客临时资料与其索引不回写其中。

访客 RAG 的输入仅为本人主动临时提供的内容与平台明确公开、该匿名受众及答案规则允许的内容；仍经资料／输出网关，不能依据问题、local_space_id、猜测的 chunk ID 或 Skill 扩大范围。解析与 embedding 只在临时工作区存活；临时输入默认不形成教师或其他学生可访问的资料。租约的运行身份、目的和来源依赖与登录者分开。

统一 operation 协议：`POST /guest-leases/{lease_id}/operations` 创建 `kind=agent/rag/execute` 的短期任务；`POST .../operations/{operation_id}/inputs` 提交学生动作或继续，含稳定 op_id 和 expected_revision；`GET .../operations/{operation_id}` 查询当前可恢复状态；`GET .../operations/{operation_id}/events` 读取 SSE；`POST .../operations/{operation_id}/cancel` 幂等取消；`POST .../operations/{operation_id}/ack` 确认终态／结果已在本地可靠保存。每次命令、工具调用、模型发送、输出批次和回放核验凭据摘要、租约状态、当前 idle/absolute 截止、预算和公开来源权限。runner 的终端票据也必须绑定此租约和具体 operation。

完成或取消时先由客户端可靠接收／保存结果，再尽快清除正文、临时输入与 checkpoint；终态未被客户端确认时只在剩余短租窗口内暂存必要的恢复载荷，hard TTL 到时无条件清除。cancel 后拒绝新内容并丢弃未发送缓冲，保留的短期状态仅供说明取消原因／幂等回复。临时服务重启导致状态丢失时返回 `GUEST_LEASE_EXPIRED`／`GUEST_STATE_UNAVAILABLE`，由本地已保存的输入和作品新建租约并重新提交，不称服务器永久恢复；过期响应不泄露原正文。

租约及 operation 的清理状态、残留文件、进程退出、缓存、Agent memory、事件缓冲、下载临时文件与未完成上传一起验收。少量匿名用量／安全审计只可记录经最小化的计数和原因，不保存学习正文、可还原 checkpoint 或稳定个人学习档案。模型提供方可能接收临时输入，提供方处理／留存规则及用户告知需按 D09 另行核实；服务器 hard TTL 不等于可以收回提供方或学生已收到的内容。30 分钟／2 小时为待清理实测的开发默认，尚未通过 D09。

## 3 数据类型和首批物理约束

### 3.1 通用约定

- 稳定 ID：PostgreSQL `uuid`，API 标准 UUID 字符串；第一阶段用 UUIDv4，浏览器以加密随机源生成本地对象 ID，服务端只验证格式和归属，不将 ID 当凭据。
- 时间：`timestamptz`，服务端生成的 UTC 时间；客户端操作时间另存 `client_occurred_at`，不能代替服务端时序。
- 可变行版本、策略修订、事件序号：正值 `bigint`；JSON 使用十进制字符串，避免 JavaScript 大整数精度丢失。大小和额度亦按明确单位传输。
- hash：`bytea`，SHA-256 长度约束 32；API 采用小写 64 位十六进制。正文 `text`；配置、定位、可扩展结果用受 Pydantic Schema 验证的 `jsonb`，核心身份／外键／状态不埋入无约束 JSON。
- 可编辑草稿采用 `version bigint`；已发布内容版本追加，原版本正文不 UPDATE。生命周期与 ACL 单独可变，授权撤回不会篡改历史内容版本。
- 私有核心实体包含所属空间／所有者和 `deleted_at`／tombstone；删除时间、授权修订、历史证据互不混用。不以级联删除抹去审计和已引用证据。

下表定义首批领域对象的最小字段与必须落实的约束；不是已执行的完整 DDL，也不把全部逻辑对象压缩到几张 JSON 表。

### 3.2 身份、空间与授权

| 对象 | 关键物理字段 | 必须约束 |
|---|---|---|
| `account` | `id uuid PK`, `account_type text`, `email_normalized text`, `password_hash text`, `status text`, `auth_revision bigint`, 时间 | `account_type IN ('student','teacher')`；`UNIQUE(email_normalized)`；`UNIQUE(id,account_type)` |
| `student_profile` / `teacher_profile` | `account_id uuid PK`, 固定 `account_type text`，教师 `verification_state`, `verification_revision bigint` | 固定类型 CHECK + `(account_id,account_type) → account(id,account_type)`；教师状态限 `pending/verified/rejected/suspended` |
| `auth_session` | `id uuid PK`, `token_digest bytea`, `account_id uuid`, `auth_revision bigint`, `created_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at`, `csrf_digest bytea` | token 摘要 UNIQUE；account FK；有效性同时比较账号状态、auth_revision、期限和撤销 |
| `learning_space` | `id uuid PK`, `owner_account_id uuid NOT NULL`, `kind text`, `origin_local_id uuid`, `version bigint`, `bound_at`, tombstone | 服务器永久学习空间必须有 owner；访客本地空间不是预创建的云端学习档案；`UNIQUE(id,owner_account_id)`；origin 映射一旦绑定不得改成另一账号 |
| `teacher_relation` / `teacher_grant` | relation ID、student/teacher profile IDs、`state`；grant ID、relation ID、课程版本、`data_scope`、purpose、revision、生效／撤回时间 | 双方分别 FK 到相应 profile；关联不自动生成 grant；授权逐课程／数据目的保存，撤销时 revision 增加 |
| `course_audience_member` | publication ID、account ID、membership state/revision | `(publication_id,account_id)` PK；受众成员权限与教师访问学生记录的 grant 分开 |

邮箱规范化规则统一在认证层，第一阶段对注册邮箱去除两端空白并按产品统一大小写规则存储，原展示邮箱另存；数据库唯一值和查询必须使用同一规则，不使用数据库 collation 偶然决定账号合并。

### 3.3 课程、资料与受控答案

| 对象 | 关键物理字段 | 必须约束 |
|---|---|---|
| `course` | `id uuid PK`, `owner_account_id uuid`, `origin_kind text`, `baseline_code text NULL`, `version bigint` | 来源限 `platform_default/teacher_custom`；教师 API 不能设置 platform_default；默认编号仅对平台课程有唯一索引，不将 13 个编号设为所有课程枚举 |
| `course_version` | `id uuid PK`, `course_id uuid`, `version_no bigint`, scope/depth JSON、workflow state、review state、`content_hash bytea` | `UNIQUE(course_id,version_no)`、`UNIQUE(course_id,id)`；course FK；发布后内容不可变 |
| `course_publication` | `id uuid PK`, `course_id uuid`, `course_version_id uuid`, publisher ID、state、`policy_revision bigint`, audience mode | `(course_id,course_version_id) → course_version(course_id,id)`；`UNIQUE(course_version_id,id)`；发布固定内容版本，受众授权可撤回 |
| `learning_objective` / `objective_relation` | objective 稳定 UUID、course_version ID、criteria JSON；边 from/to、type、source | objective 版本组合 PK；两端均复合 FK 到同一 course_version；仅目录／强制先修做无环验证，概念／应用关联允许成环 |
| `reference_resource` / `resource_version` | resource ID、owner ID；version ID、resource ID、immutable hash、MIME、blob ID、lifecycle | `UNIQUE(resource_id,version_id)`；资源 owner 与上传授权核对；内容版本不可变，lifecycle 单独可变 |
| `resource_student_copy` | source resource_version ID、student_copy_version ID、selection hash、teacher reviewer、reviewed_at | 学生副本是独立且真实清除未公开组成的资料版本；保留原件谱系不授予原件权限 |
| `course_resource_binding` | `id uuid PK`, course_version ID、publication ID、供学生读取的 resource_version ID、`student_visible boolean DEFAULT false`、state、`policy_revision bigint` | `(course_version_id,publication_id) → course_publication(course_version_id,id)`；resource_version FK；`UNIQUE(publication_id,resource_version_id)`；新绑定和新资料版本不继承公开选择 |
| `answer_policy_version` | policy ID、`task_publication_id uuid`、policy revision、rule JSON | `UNIQUE(task_publication_id,id)`；不可变策略内容引用；改变规则产生新策略版本及当前授权修订 |
| `content_answer_policy_ref` | 提供对象／切片／派生版本 ID、原 task_publication ID、answer_policy_version ID | 复合 FK 保证 policy 属于原发布实例；只由服务端维护；任务切换或不传 task 不删除关联 |

仅资源 UUID 的单列 FK 不足以校验跨空间的作品引用，带空间／课程版本的关系必须采用复合 FK 或严格同事务验证，不能把这一规则交给客户端。`content_answer_policy_ref` 在迁移中拆成明确的资源版本／切片／派生版本关联表，避免无法验证的万能 `object_type + object_id` 外键；若某资源整体无法可靠分离受控答案，整个提供版本按相关策略检查。

### 3.4 解析、检索与谱系

| 对象 | 关键物理字段 | 必须约束 |
|---|---|---|
| `resource_parse` | parse ID、resource_version ID、`parser_profile_version text`、config hash、state、warnings JSON、parse hash | `UNIQUE(resource_version_id,parser_profile_version,config_hash)`；`UNIQUE(resource_version_id,id)`；就绪状态必须对应真实持久化完成 |
| `resource_chunk` | chunk ID、resource_version ID、parse ID、ordinal integer、`body text`、hash、`locator jsonb`、`lexical_vector tsvector`、`tokenizer_profile_version text` | `(resource_version_id,parse_id) → resource_parse(resource_version_id,id)`；`UNIQUE(parse_id,ordinal)`；`UNIQUE(resource_version_id,id)`；定位含页／slide／段落和允许的组成 |
| `embedding_space` / `resource_embedding` | space ID、模型与修订、`dimension smallint`、normalize config；chunk ID、space ID、dimension、`embedding vector`、state | 一个 embedding_space 固定维度与模型且 `UNIQUE(id,dimension)`；embedding 的 `(space_id,dimension)` 复合 FK；`CHECK(vector_dims(embedding)=dimension)`；`UNIQUE(chunk_id,space_id)`；不同模型空间不混算距离 |
| `derived_artifact_version` / `derivation_source` | derived version ID、hash、生成运行、review state；source version/chunk ID、定位、hash | 原来源明确 FK；未独立发布默认私有；独立发布正文与公开引用只指向教师确认的派生版本 |
| `derived_publication` | derived version ID、course_publication ID、publisher、state、revision | 自身授权单列；与受控答案 refs 一起检查；内部私有来源链不返回学生 |
| `retrieval_run` / `retrieval_access_event` | actor、可信 purpose、课程／发布实例、候选 ID、source revisions、permission result、阶段、时间 | 记录 load/context/model_dispatch/emit/replay 各阶段；不默认持久化私有正文或完整 prompt |

切片不把某一次课程绑定当唯一所有者：同一资料版本可经不同课程绑定复用。检索许可来自当前 publication + binding + audience + resource lifecycle + answer refs 的交集；index 内的旧 revision 只用于发现失效，不能代替这些表。PPT 私有原件与学生副本有不同版本和解析，不能通过共享 parse cache 把备注送入学生结果。

### 3.5 作品、证据、工作流和同步

| 对象 | 关键物理字段 | 必须约束 |
|---|---|---|
| `artifact` / `artifact_version` | space ID、artifact ID、current version；revision UUID、parent revision、blob/content ref、hash、author source | `UNIQUE(space_id,id)`；revision 复合 FK 到所属 artifact；parent 与该 artifact/space 一致；并发编辑保留分支，不能静默覆盖 |
| `attempt` / `execution_job` | space、activity version、作品 revision、runtime manifest version、status、idempotency key | 作品／attempt/job 引用以同一 space 复合 FK；job 创建绑定版本；迟到结果只能回到原 attempt |
| `verification_event` / `objective_evidence` | UUID、space、标准/作品/课程/目标版本、reviewer/tool refs、criteria JSON、assistance/provenance | 追加式；evidence 的 course_version/objective 复合 FK；不以 Agent 文本或客户端自报建立独立达标 |
| `agent_run` / `run_event` | run ID、space／主体、可信 purpose、workflow version、state；event ID、`sequence bigint`、type、payload/ref、provenance | `UNIQUE(run_id,sequence)`、event UUID UNIQUE；一个 run 终态只落地一次；学习完成状态与 run.completed 分开 |
| `sync_operation` | space、`op_id uuid`、object ID/type、base version、canonical payload hash、result/state、created_at | `(space_id,op_id)` PK；相同 key、相同 hash 返回原结果；hash 不同返回冲突；不以新的 request_id 重复应用 |
| `sync_object_map` / `space_change` | owner、origin space/object IDs、server object ID；space、`sequence bigint`、object/revision/tombstone ref | origin 组合唯一且账号映射不变；`UNIQUE(space_id,sequence)`；删除与 ACL 修订不被旧设备回传撤销 |
| `sync_claim` | `claim_id uuid PK`、`expected_account_id uuid`、`origin_local_space_id uuid`、固定 manifest hash、server space ID、状态／提交时间 | claim 的账号由 session 一致性校验；origin 归属全局唯一；同 claim ID 不同账号／origin／hash 冲突；与空间及映射在同一事务提交，记录归属元数据不预存访客正文 |
| `outbox_event` | ID、aggregate kind/ID、revision、event type、payload refs、delivery state／lease | `UNIQUE(aggregate_kind,aggregate_id,revision,event_type)`；与业务变更同事务；发送重试不能重复应用 |

对象版本与 API 的大整数规则一致。全部关键状态加 CHECK／枚举验证；跨表规则采用复合 FK、事务和明确验证，不假定一段 CHECK 可以读取另一张表。首批迁移从账号／空间／课程版本开始逐领域建立，完整 DDL 作为代码交付并由数据库实测证明。

## 4 权限在数据库和应用中的落点

PostgreSQL 中的 session、主体状态、grant、audience、binding、resource lifecycle 和答案策略是权威来源。后台 Worker、索引器、模型网关不能用索引 metadata 或缓存中的 `allowed=true` 决定读取。

采用应用领域授权 + 私有空间数据的 PostgreSQL RLS 防御。迁移 owner 与运行账号分开：`vault_migrator` 仅用于受控迁移，`vault_api`／各 Worker 角色 `NOSUPERUSER NOBYPASSRLS` 且不是表 owner；私有表 `ENABLE/FORCE ROW LEVEL SECURITY`，读写策略分别设计。业务角色无法切换为 migrator。管理作业使用独立、最少权限角色和审计，模型工具没有这些凭据。[PostgreSQL RLS 的 owner／BYPASSRLS 边界](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)。

请求先验证服务器 session，然后在事务内 `SET LOCAL` 可信 account/space 上下文；连接池归还后不能残留上个用户上下文。空上下文默认拒绝。上下文只由服务端写入，RLS 无法补救可信后端主动伪造身份，也不能代替答案或跨课程授予规则。RAG 只经专门的授权查询服务加载，不能对 chunk 表开放任意客户端 SQL。FK 错误、唯一冲突和日志对外统一处理，避免通过约束细节探知私有对象存在性。

教师授权读投影必须显式列出可见字段和作品版本；不使用 `SELECT *` 后交给前端隐藏私人聊天。RLS 的教师授权路径与应用 grant 一致，服务端自行解析 teacher/student profile，不接受客户端提交的角色、owner 或索引集合。

## 5 中文混合检索的确定实现

1. 解析后以 jieba 在业务 Worker 做中文分词，采用固定 tokenizer profile、固定计算机术语词典与大小写／符号规范化，存入版本元数据。查询走同一 profile。英文标识符、代码词和 `C++` 等术语额外保留可查 token，不能把符号随意删掉。
2. 将已分词且空格分隔的 token 流交给 PostgreSQL `to_tsvector('simple', ...)`，保存 `tsvector` 并建 GIN 索引；查询构建受限 `tsquery`，不拼接用户输入 SQL。词法 rank 用 `ts_rank_cd`；这是 PostgreSQL 词法相关性，不宣称等于 BM25。
3. 默认 embedding_space 固定为 BAAI/bge-m3 dense 1024 维和经固定权重生成的向量，用 pgvector cosine 距离做同一空间召回，按当前授权集合 JOIN/EXISTS 前滤。首版用精确距离查询，模型权重、tokenizer 和归一化配置是索引版本的一部分；未来换模型创建新空间，不与旧向量混算。
4. 两路仅对有权限的 ID 排序，用 RRF 合并后再次检查 ACL，方可加载正文和送重排／模型。初始内部值各取 30 个 ID、合并最多 12 个，进入上下文最多 6 个、正文预算 6000 token；只作启动配置，中文及代码评测后调整并版本化。
5. 容量测量证明精确检索不足后再启用按模型维度固定的 HNSW 索引；ANN 的筛选可能影响可返回数量，需验证 iterative scan 和精确回退，不能为凑数量放宽可见条件。目录／资源／模型维度索引分别记录生成版本，重建完成前旧索引不扩大权限。

默认模型的 1024 维和 MIT 许可可在官方 model card 核对；选择该模型是项目方案，相关性、CPU 时延和资源需求尚未由本项目测量。本轮不下载权重、不宣称已运行模型。[BAAI/bge-m3 官方模型说明](https://huggingface.co/BAAI/bge-m3)。

PostgreSQL 内置 parser 不负责本项目所需的中文词法切分；这里明确由外部 tokenizer 生成词项再入库，不把英文 text search 配置当作中文支持。jieba 是实现选择，分词质量和 Python 3.13 下完整 pipeline 尚需实测；失败时停止构建该词法索引而非悄悄宣称 ready。[PostgreSQL parser](https://www.postgresql.org/docs/18/textsearch-parsers.html)、[jieba 官方项目](https://github.com/fxsjy/jieba)、[pgvector 过滤与 iterative scan](https://github.com/pgvector/pgvector#filtering)。

检索回归集至少覆盖中文专业名词、英文缩写、代码符号、精确 slide 定位、同资料跨课程不同权限、私有来源、受控答案、撤回后旧索引和无资料场景。没有经过这些检查，不能宣称中文 RAG 已支持或准确。

## 6 撤权、模型发送与流式回放

采用统一授权／输出网关。发送模型上下文前以及每个有内容的输出批次前，已登录路径在同一短事务按固定顺序锁住 PostgreSQL session、account 和相关授权行，核验 account status、auth_revision、撤销和当前 idle/absolute expiry，同时核验受众、绑定、资源状态与答案授权 revision；使用 `FOR SHARE` 与对应撤销 UPDATE 互斥。访客路径在 GuestLeaseStore 原子核验短期凭据、lease revision、状态与当前 expiry，获得仅供当前有界批次的 admission，再核验公开来源许可；后续批次不能复用 admission。账号权限变化与 session 撤销须进入相同当前许可检查，不能只校验课程 ACL。授权锁不跨整个模型推理过程持有。

网关在有明确 payload 上限和发送／锁超时的批次内交付模型请求或学生输出；禁止跨无界网络等待持锁，超时即中止批次并释放事务。权限不明、行不存在、策略冲突或当前凭据到期则停止，不沿用旧成功结果。Worker 只能请求网关发送，不能绕过网关直接把课程资料传给模型或 SSE。没有引用显示的模型文本仍继承本次上下文的全部受限来源依赖，不能以“这句话没引用”绕过撤权。具体批次长度与超时须在 B04 的阻塞／撤销竞态测试中固定，不把未测的锁方案称为通过安全验收。

撤权事务先更新策略及 revision、写 outbox，再提交并返回 `access_revoked=true`；索引／缓存清理随后执行。提交后不能产生新的授权批次；提交前已交给模型提供方或网络缓冲的内容无法收回，可能稍后到达，界面明确此边界。不能宣称撤回会删除学生已经下载的内容。精确锁范围、超时与网络发送边界必须在真实 PostgreSQL 并发测试中验证。

SSE 每个输出 batch 和每次回放都同时复查 session／account status／auth_revision／撤销／当前 expiry（登录者），或 guest lease 状态／凭据／当前 expiry（访客），以及 run 所属空间或租约和来源依赖；不能只在建立 SSE 时验证一次身份。账号事件可存 PG payload 引用或受限载荷，访客事件仅存第 2.3 节的临时服务，回放都不是简单把旧字符串直接送出。失效后丢弃未发送内容、暂停相关运行，返回不含私有名称的到期／不可用事件并关闭流；审阅独立发布物依据其自身授权，原件撤回不自动取消该发布物，教师选择同时撤回时在返回成功前一并提交授权变化。

## 7 REST 与 SSE 接口基线

### 7.1 通用格式

- 统一 `/api/v1`，JSON UTF-8、snake_case、UUID 字符串、UTC RFC3339 时间。主键与幂等 key 不接受任意长度文本。
- `X-Request-ID` 为日志关联，服务器校验或生成；创建／提交使用 `Idempotency-Key: <UUID>`。二者不同职责。
- PATCH／删除／发布变更使用 `If-Match: "<bigint decimal>"`；缺失必要前置条件返回 428，版本冲突返回 412 + 当前允许查看的 revision，不静默覆盖。
- 幂等键作用域为可信账号／空间 + 操作类型；相同 key 不同 canonical payload hash 返回 409 `IDEMPOTENCY_CONFLICT`。同事务提交业务变更与幂等结果，重试返回原对象。
- 400 格式错误，401 未登录，403 允许明示的自身权限不足，404 私有对象不存在或不可见，409 业务／同步冲突，412 版本条件冲突，422 字段语义验证，429 配额／限速，503 环境暂不可用。错误含 `code,message,request_id,retryable,details`，禁止私有对象名称和数据库异常栈泄露。
- Pydantic 对写入模型 `extra='forbid'`，严格验证 role/purpose 以外的允许字段；客户端 `purpose` 只是意图，服务端根据 endpoint 和业务动作决定可信用途。生成 OpenAPI 3.1，CI 比较 Schema 变化并生成 TypeScript API client。

### 7.2 具体路径与逻辑 API 映射

| 方法／路径 | API 映射 | 关键行为 |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/csrf` | API-01 | 服务器 session；me 返回账号类型、教师核实状态和当前授权摘要；预认证与已登录 CSRF 分开 |
| `GET /courses`, `GET /courses/{id}/versions/{version_id}` | API-02 | 只返回允许目录／蓝图，来源和审阅状态明确 |
| `POST /spaces/{id}/goals`, `PATCH /spaces/{id}/goals/{goal_id}` | API-03 | 学生确认／变更，版本检查；服务器解析 owner |
| `POST /spaces/{id}/sessions`, `GET /spaces/{id}/sessions/{session_id}` | API-04 | 恢复明确活动／作品版本与待办 |
| `POST /spaces/{id}/agent-runs`, `POST /agent-runs/{run_id}/inputs` | API-05 | 202 创建或恢复任务；student input 另有幂等与期望 run revision |
| `POST /spaces/{id}/artifacts/{artifact_id}/versions` | API-06 | 新 revision 引用 parent；冲突保留原稿 |
| `POST /execution-jobs`, `POST /execution-jobs/{id}/cancel` | API-07 | 不可信代码只发执行服务，返回真实排队／环境状态 |
| `POST /spaces/{id}/verification-events` | API-08 | 标准／作品／课程版本固定；异步核验返回 job，客户端状态不具证据权威 |
| `GET /spaces/{id}/courses/{version_id}/graph` | API-09 | 唯一目标集合、版本、状态和原因，不将 parent 计入分母 |
| `POST /sync/claims`, `GET /sync/claims/{claim_id}`, `POST /spaces/{id}/sync/batches`, `GET /spaces/{id}/sync/changes?cursor=...` | API-10 | claim 前先写本地 journal；请求和本人恢复查询均固定 claim_id；显式归属后逐操作同步 |
| `/skills`, `/skills/{id}/versions`, `/skills/{id}/reviews` | API-11 | 方法按创建／读取／提交复核定义；Skill 不包含平台权限赋值 |
| `/teacher-relations`, `/teacher-grants`, `/task-publications` | API-12 | 邀请、关系、授权、发布分别动作；授权修订独立 |
| `POST /spaces/{id}/exports`, `POST /spaces/{id}/deletion-requests` | API-13 | 202 可查任务；内容和留存／审计边界分别说明 |
| `POST /teacher/courses`, `POST /teacher/courses/{id}/versions/{version_id}/publish` | API-14 | 空白或 AI 私有草案；发布校验 verified、版本、受众、能力与审阅 |
| `POST /resources/uploads`, `POST /resources/uploads/{id}/complete`, `GET /resources/{id}/versions/{version_id}/parse` | API-15 | 两阶段上传／hash校验；受控解析任务；完成上传不等于已公开 |
| `PATCH /course-publications/{id}/resource-bindings/{binding_id}`, `GET /resources/{id}/versions/{version_id}/content` | API-15 | 可见性 If-Match；读取／下载同一权威授权，学生副本不可被原件替换 |
| `POST /spaces/{id}/rag-runs`, `POST /teacher/courses/{id}/design-runs` | API-16 | 学生问答和教师备课不同可信用途；内部检索工具不向浏览器开放任意 chunk 查询 |
| `GET /agent-runs/{id}/events`, `GET /jobs/{id}/events`, `POST /agent-runs/{id}/cancel` | 通用异步 | fetch 流式 SSE，每次显式 Last-Event-ID；batch／回放重新验证身份及来源；取消幂等 |
| `POST /guest-leases`, `/guest-leases/{lease_id}/operations` 及各 operation 的 `/inputs`、`/events`、`/cancel`、`/ack` | 访客 API-05／07／16 | 共同短期 lease，仅临时处理；第 2.3 节定义方法、恢复与清理，不借此建立永久空间 |

上述为确定路径基线；细分子资源随该领域实现补齐并保持语义映射，不能宣称表内路径已经有可调用服务。

### 7.3 Schema 与事件示例

以下 OpenAPI 片段用于接口实现起点，不是已通过 validator 的完整文件；实际 OpenAPI 由 FastAPI 生成并入库，禁止手工片段与运行实现长期分叉。

```yaml
openapi: 3.1.0
info: {title: Vault API, version: 1.0.0}
paths:
  /api/v1/course-publications/{publication_id}/resource-bindings/{binding_id}:
    patch:
      operationId: updateResourceBinding
      security: [{sessionCookie: []}]
      parameters:
        - {name: publication_id, in: path, required: true, schema: {type: string, format: uuid}}
        - {name: binding_id, in: path, required: true, schema: {type: string, format: uuid}}
        - {name: If-Match, in: header, required: true, schema: {type: string}}
        - {name: X-CSRF-Token, in: header, required: true, schema: {type: string}}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              required: [student_visible]
              properties:
                student_visible: {type: boolean}
      responses:
        '200':
          description: 权威授权已提交，异步清理状态另报
          content:
            application/json:
              schema:
                type: object
                required: [binding_id, policy_revision, student_visible, access_revoked, cleanup_state]
                properties:
                  binding_id: {type: string, format: uuid}
                  policy_revision: {type: string, pattern: '^[1-9][0-9]*$'}
                  student_visible: {type: boolean}
                  access_revoked: {type: boolean}
                  cleanup_state: {type: string, enum: [not_required, pending, complete]}
        '404': {description: 不存在或当前不可见}
        '412': {description: 授权修订与 If-Match 不符}
        '428': {description: 缺少版本前置条件}
components:
  securitySchemes:
    sessionCookie: {type: apiKey, in: cookie, name: __Host-vault_session}
```

SSE 选用 `fetch` + ReadableStream 客户端，显式解析 SSE frame，客户端不依赖原生 EventSource 在刷新后自动保留游标。登录请求 `credentials: 'same-origin'`，访客请求显式 lease header；每次首连、重连与页面刷新后的恢复先从对应本地账号／lease 命名空间读取最后可靠处理的游标，再明确发送 `Last-Event-ID: <sequence>`，无游标首次请求用 `0`。收到事件后先幂等应用并持久保存本地结果，再提交游标，不能先推进游标而丢失内容；账号切换或 lease 变化不能复用旧 namespace 的游标。

SSE `id` 为该 run 的十进制 sequence，`event` 为版本化类型，`data` 是 JSON；客户端按 run_id + event_id 去重。服务端先验证当前 session／lease 和 run 归属，再检查 cursor；事件窗口过期返回显式 `EVENT_CURSOR_EXPIRED` 和允许读取的当前快照，不以从头重播代替恢复，访客 lease 已失效按第 2.3 节本地重建。心跳无业务 sequence、不替代身份期限校验；每个内容 batch 与回放遵守第 6 节的完整身份／来源复查，终态事件唯一。示例：

```text
id: 42
event: student.input_required
data: {"event_id":"0432547e-4d94-4f3c-a903-93ca9be46f42","run_id":"08aa248a-4eb2-4ec6-bf2f-bc80810d2e60","sequence":"42","occurred_at":"2026-10-03T15:00:00Z","activity_version_id":"4b7b7ad9-93e0-4a9b-91bc-31ff59006a7b","input_kind":"artifact_revision"}

```

交互式终端不能用 SSE 伪装双向连接。独立 WebSocket 用一次性短租票据、当前 session／guest lease + Origin 核验、指定 job 和命令范围；连接后首次握手传票据，不把它放 URL，命令及输出批次复查当前凭据、撤权、到期和取消后停止通道。未登录 runner 与 Agent／RAG 共用第 2.3 节的 guest lease，不建立永久云端学习档案。

## 8 本地关联与同步的具体事务

登录入口明示“登录并关联本机未绑定记录”及当前空间范围，一次登录承接动作表达意图，不增加重复确认。认证为账号A后自动发起承接：客户端在任何claim请求前先以IndexedDB事务写journal，固定 `claim_id`、`expected_account_id=A`、`origin_local_space_id`、manifest hash、`state=pending`。清单取本次承接快照，后续操作另排队，不改该hash。journal与pending归属一起持久化，只允许A恢复；超时、刷新、退出或切B不能把它退为未绑定并重新claim。

`POST /sync/claims` 携带同一 claim_id 和上述固定字段，`Idempotency-Key` 与 claim_id 相同。服务端以当前 session account 校验 expected_account，不能按客户端 account 字段授予归属；事务同时创建 sync_claim、本人服务器空间与不可变 origin 映射。同 claim_id／同固定字段重试返回原结果；同 claim_id 内容不同返回 409，origin 已归属其他账号则拒绝转移。已存在同账号 origin 映射时返回该已有归属，不能创建第二份空间。服务器提交成功是归属成立点，不以客户端是否收到响应为准。

响应丢失或结果未知时，客户端保留 pending journal；账号 A 可 `GET /sync/claims/{claim_id}` 查询本人的提交结果，或使用完全相同的 claim 请求幂等重试。查询由 session 限定账号，B 不能查看 A 的 mapping 或凭 claim_id 转移；不可见统一错误，不泄露其他账号信息。A 的恢复查询确认已提交后，本地原子写入最终归属、server_space_id、`state=committed` 和待上传 outbox，再逐批上传。仅查询不到结果不能证明此前在途请求绝不会提交，因此结果未知时不得开放重新绑定其他账号；需恢复原 claim 至确定状态。

换号后已归属或pending属于A的空间仍隔离，B使用另一空间，不能承接旧数据。以上覆盖服务端成功但响应丢失后切B；永久claim仅在成功登录及入口明示范围的承接动作后创建，未登录无永久映射。归属与上传分开显示，不以整批上传完成作为绑定判据。

每项 operation 必须含 `op_id, object_type, object_id, base_version, payload_hash, payload`。首个版本用 `base_version="0"`；服务器在所属空间锁住对象，先检查 op_id，再检查 base_version，验证 FK/来源/答案权限，提交新版本、同步结果和 space_change。同批独立项可部分提交，有依赖项按明确顺序执行；依赖失败标记 `dependency_pending`，不能假成功。`updated_at` 不是冲突解决依据，删除 tombstone 不被旧 UPDATE 复活。

返回逐项 `applied/already_applied/conflict/rejected/dependency_pending` 及允许读取的 current_version；冲突保留两个作品分支，用户确认选择才更新 current 指针。同步游标是服务端签发的 opaque 值，绑定 space 和快照水位，不能通过篡改 cursor 读取另一账号。服务端版本以事务和单调序列排序，客户端时间不能调高版本。

访客历史作品、尝试和帮助可导入，但标注 `client_reported`；客户端上传“核验通过”不直接建立独立达标证据。在线工具结果要校验服务端实际 job、来源、作品 hash、标准／课程版本及可用期限；无法验证的本地结果保持待复核。附件用分块／重试后完整 hash 和长度确认，未完成附件不作为可核验证据，文件处理租约也不代表永久学习档案。

## 9 发布与撤销的一致性

课程发布在单个 PostgreSQL 事务内固定课程范围、内容／活动／标准／答案版本、受众与教师审阅记录，校验每个开放活动有真实实践和核验路径；需要人工／外部证据的活动如实记录，待适配目标继续保留。创建课程数不受 13 门编号限制，平台默认课程验收要求不因此下降。

ACL 变更、outbox 和相应 workflow invalidation 持久化同事务；消费至少一次，消费者以稳定 event ID + aggregate revision 去重，旧索引 job 提交前检查状态，不能复活已撤回版本。数据库提交后失败的 OSS/模型调用用 lease、幂等和补偿状态恢复，不宣称跨 PostgreSQL、OSS、模型提供方存在全局原子事务。

## 10 实现验证门

| 门 | 必须交付的验证 | 未通过时 |
|---|---|---|
| B01 依赖 | Linux 生产架构下 Python 3.13 全依赖安装、SQLAlchemy/psycopg async、解析器与分词 smoke；固定锁文件和 image digest | 阻止该服务发布，必要时 ADR 调整单独解析 Worker 运行时 |
| B02 数据库 | PG18 + pgvector 构建、从空库／旧版本迁移、关键复合 FK、跨空间插入拒绝、事务回滚和备份恢复 | 不宣布物理模式可部署 |
| B03 认证 | 密码参数压力、CSRF/Origin、session 到期／撤销、SSE 长连接期间 account status/auth_revision/expiry 变化、教师核实、RLS 连接复用和错误隐私 | 不开放真实账号使用 |
| B04 RAG | 中文／代码回归、学生副本、原发布答案 refs、跨课程权限、缓存／Agent／引用旁路、流式撤权与回放竞态 | 不开放资料问答／学生发布 |
| B05 同步 | claim 发出前 journal、提交成功响应丢失后切 B 拒绝、A 固定 claim 查询恢复、同 key 不同 hash、跨账号 origin、版本冲突、删除复活、附件及伪造 evidence | 不开放账号学习数据同步 |
| B06 异步／访客 | worker 崩溃／lease 超时、outbox 重投、cancel／迟到结果、fetch SSE 刷新显式游标、账号／lease 切换、匿名 Agent/RAG/runner 全程、guest 清理及永久存储／备份无正文检查 | 不以 mock 状态冒充可恢复工作流；guest 清理须通过 D09 后开放 |

本文已选定技术、字段与接口方向；B01–B06 是必须实施的检查，不是继续待选方案，也不是本轮已通过的测试。生产容量、具体付费配额、用户告知的资料／日志／备份留存数值在发布前测量并冻结，不能仅因数据库支持该字段就称运营准备完成。
