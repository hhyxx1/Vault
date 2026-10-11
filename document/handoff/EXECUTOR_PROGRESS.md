# 执行进度（EXECUTOR_PROGRESS）

> 接续 `document/handoff/13-course-delivery-2026-10-10/` 交接方案。本文件由执行体持续维护，供跨会话/交回 Codex 接续。只记录已验证事实，不写“全部完成”。

## 当前检查点

- 更新时间：2026-10-11（#29 / P1：**C01 公共工程核心闭环**——切片 A 受信配置侧车、切片 B 非 CS 编号合成课 + extra_courses 三分区、分发契约与归档审计；C02 语义核验此前已完整闭环。下一项 C03）
- worktree：`C:\Users\Remote\.codex\worktrees\485f\Vault`（detached HEAD）
- HEAD：`98e3e10`；远端 `mine/hyx_dev`（https://github.com/hhyxx1/Vault.git）。
- 复核报告：`document/handoff/EXECUTOR_FINAL_REPORT.md`（阶段性；13 课端到端未完成，已如实界定，全部完成后重写）。
- C01 本次新增提交（新→旧）：
  - `98e3e10` test(c01): 一目标一活动分发契约 + 侧车多对多绑定守卫（+5 测试）
  - `0202dd7` C01 slice B: synthetic workshop course and data-driven extra_courses（合成课 + 三分区 + 前端数据驱动 + e2e）
  - `dd4e976` C01 slice A: server-side trusted check config sidecar（受信配置侧车机制 + 15 测试）
  - 台账 `5006eb8`；更早 `669eb57/a153607/e3aec9c/2d8c317/7b6da20`。
- 最新验证基线：后端 **466 passed / 58 skipped / 0 failed**；前端 typecheck 0、vitest **107 passed / 17 files**；合成课 Playwright chromium 与 mobile 各 **3/3**（真实 WSL isolate worker 8091/box700）；ruff 全过。

## 任务板状态（#23–#32）

- #23 completed — 迁移/Dexie/契约/CS05 包身份/测试库指向核对（head=0012_algebra_attempt，Dexie v10，CS05 0.2.0 三 finite_algebra 活动）。
- #24 completed — 服务栈启动并探活：PG 5442、WSL isolate worker 8091、后端 8000、前端 5176。
- #25 completed — CS05 收尾测试全部复现（证据见下）。
- #26 completed — health/ready 的 isolated_execution 不再写死 false，拆分为 configured / healthy / production_ready 三独立字段，并新增 worker 侧认证健康探针。
- #27 completed — algebra_attempt 全站覆盖复核；唯一缺口（学习证据总页未展示代数实验）已补齐并加 e2e。
- #28 completed — 逐课只读审计并校准 TASK_BOARD.csv：122 模块全 in_progress、source needs_audit、review blocked_external，无一项 verified。
- #29 in_progress（**P1**）— 公共工程 C01–C08。**C02 语义核验后端三层已全部闭环并提交**：核心 `40bac6d`（多输入+受信独立 oracle+替代正确解+反硬编码+环境故障不降级，13 测试）、公共发现 `ae6ce27`（课程包声明元数据+注册表一致性契约，5 测试）、同步协议收口 `cf25381`（导入套件结果绑定冻结上下文、不授掌握、与固定题互斥，1 测试函数）；后端全量 **446 passed/58 skipped/0 failed**。**剩余为前端全链路**（触发/渲染、本地证据、证据页/图谱/导出/恢复、前端同步）与 WSL 真实 isolate 多 case e2e；C01、C03–C08 待续。
- #30–#32 pending — P2 CS05 其余原生模块+CS03 回填+五类桥接；P3–P5 其余 10 课；P6–P7 教师/自建课/RAG/多模型/Skill 与全面验收、UI 对照、最终报告。

## 已完成项与真实证据

### 环境恢复（P0）
- 后端 venv 基础解释器曾整体丢失（`.venv\pyvenv.cfg` 指向的 `C:\Users\Remote\AppData\Local\vault-python-runtimes\cpython-3.13.16-windows-x86_64-none` 不存在）。用 uv 0.12.22（`C:\Users\Remote\AppData\Local\Temp\vault-uv-tools\bin\uv.exe`）以 `UV_PYTHON_INSTALL_DIR=...\vault-python-runtimes` 重装 CPython 3.13.16 到原路径，venv 复活且 site-packages 保留。
- Docker Desktop/WSL 启动后 PG 容器完成崩溃恢复；WSL `vault-code-worker.service` active，监听 127.0.0.1:8091。
- 共享 pytest 临时目录 `%TEMP%\pytest-of-Remote` 权限损坏（WinError 5，疑似 WSL root 侧运行污染），导致 82 个 setup error。**后续所有后端 pytest 必须带专属 `--basetemp=%TEMP%\vault-pytest-<名>`**。

### 测试基线（2026-10-11 复现，原始日志已归档到 `document/course-reviews/test-runs/`）
- 后端含 PG 全套：**446 passed / 58 skipped / 0 failed**（C02 后端三层后基线；P0 末为 427/58，C02 新增 13 个语义套件测试 + 5 个发现契约测试 + 1 个同步绑定测试函数）。58 skipped 为 Windows 主机上的 Linux/isolate 专用测试。原始日志 `%TEMP%\t29-sem.txt`(13)、`t29-semc.txt`(5)、`t29-sync.txt`(3)、`t29-b2.txt`(446 全量)。
  - 复现 417 基线需配置可销毁测试库：`VAULT_TEST_DATABASE_URL=...vault_dev...@127.0.0.1:5442/vault_ci`、`VAULT_TEST_API_DATABASE_URL=...vault_api:ci-runtime-ephemeral-only.../vault_ci`、`VAULT_TEST_DATABASE_IS_DISPOSABLE=1`。容器内 vault_ci 已在 0012、vault_api 为 NOBYPASSRLS 非超管且已对 sync_object 等表授权（活动数据复用 sync_object 多态，无独立 algebra/code 表）。
- 前端：typecheck 0 error；vitest **104 passed / 17 files**。
- CS05 原生有限代数 e2e：**6 passed**（chromium 桌面 + mobile 各 3）。
- 日志：`CS05_BACKEND_2026-10-11.txt`、`CS05_WEB_VITEST_2026-10-11.txt`、`CS05_WEB_TYPECHECK_2026-10-11.txt`、`CS05_NATIVE_E2E_2026-10-11.txt`。

### #26 health/ready 修复（已端到端验证）
- `code_execution.py`：新增 `IsolateWorker._isolate_available()` 与无副作用 `execution_support()`（不 init/不锁 box、不运行学生代码），`run()` 复用同一判断。
- `code_worker.py`：新增需 Bearer 认证的 `GET /v1/health`；测试替身（无 execution_support）回退为通用 ready 报告。
- `code_worker_client.py`：新增短超时 `health()`（非 200/传输异常/非法 JSON 均返回 None，不重试、不泄露响应体）与 `assess_code_execution()`。
- `api.py`：ready 输出 `isolated_execution_configured` / `_healthy` / `_production_ready`；布尔 `isolated_execution` 现反映**实时运行健康**（configured and healthy）而非固定 false；production_ready 要求 environment=production 且 https worker 网关，loopback http 恒 false；rag 保持 false（RAG 服务未建，诚实）。create_app 支持注入 code_runner 以便测试。
- 实测（重启 WSL worker 与后端后）：无 token 探 worker → 401；带 token → `{status:ready, engine:isolate, available:true, box_id:700, isolate_present:true, privileged:true}`；`GET /api/v1/health/ready` → isolated_execution/configured/healthy=true、production_ready=false、database=ready、accounts/sync=true。
- ready 响应在 openapi 中为自由形态 `schema:{}`，本次改动**无需**重生成契约；前端不消费该字段。

### #27 algebra_attempt 全站覆盖复核（已提交 c6988fe）
- 以 code_attempt / structured_attempt 为参照逐消费点对比，确认 algebra_attempt 已对等接入：本地 DB（ObjectType union、Dexie v10 `algebraAttempts` 表、saveAlgebraAttempt、openLocalSpace/clearGuestSpace/activateSpace 事务表清单与计数）、云同步（sync.ts types/syncTables/tableFor、恢复 resultTrust=client_reported/requires_review）、服务端（sync.py 白名单、sync_models CHECK、sync_schemas payload、0012 迁移 guard）、本地导出（LocalSpace exportSpace 事务与计数）、账号恢复（LocalProvider context/refresh/clear）、课程卡与图谱（Atlas 客观状态聚合、选中目标代数 nativeCriteria、图谱证据 details）。
- **唯一缺口**：学习证据总页 `ui/Evidence.tsx` 原本只有 code/structured 区。已补代数实验证据区（mode 中文标题、objectiveCode、按 prediction_correct 的穷举核验结论、criteria 中文映射、恢复待复核提示、可折叠的性质预测/解释/标准版本/检查器/作品 hash、回链 `/learn/<objective>`）；顶部概览 verified/restored 计数与空状态一并纳入 code/structured/algebra。
- 测试：扩展 `course-algebra.spec.ts` O01 用例，末尾访问 `/evidence` 并断言眉标「有限群运算表实验 / FINITE CHECK」、h2 `CS05-M07-O01`、穷举核验一致文案与展开后的「我判定成立」；**e2e 6/6（桌面+手机）**、typecheck 0、vitest 104。日志 `CS05_ALGEBRA_EVIDENCE_E2E_2026-10-11.txt`。

### #28 逐课审计与 TASK_BOARD 校准（已提交 51f165a）
- 新增幂等只读审计器 `tools/curriculum/audit_task_board.py`（标准库，ruff 通过；默认 dry-run，`--write` 落盘；读带 BOM 的 CSV 用 utf-8-sig）。
- 客观结论（122 模块 / 366 目标，与快照一致）：**366/366 目标全部绑定 practice_ready 活动**；活动类型为 363 个 code + CS05-M07 的 3 个原生 finite_algebra；检查版本几乎全为通用 `code-fixed-condition-v1`（CS01 为 `cs01-fixed-condition-v1`，M07 为 `finite-algebra-exhaustive-v1`），即仅固定条件 stdout/穷举核验；变体大多每活动仅 1（M07 为 0）；图谱 relations 稀疏（每课 10–22 条，CS01-M01 关系端点覆盖 0/3，其余多为 3/3）；13 课包 status=structured_validated、curriculum_review_state=unavailable。
- 另有**独立工程样例**（未回填正式模块大纲）：`content/courses/CS03.structured-evidence.json`（CS03-STACK-01/02、CS03-QUEUE-01/02，共 5 个 trace/judge 活动）、`content/courses/CS05.logic-example.json`（CS05-LOGIC-01/02 真值表，engineering_example/pending）。
- 校准口径（MODULE_WORKBOOK 枚举 verified/in_progress/blocked_external/needs_audit）：122 模块 module/theory/activity/check/variant/graph/integration 均 `in_progress`（有在位产物但八项未齐、无一闭环）；source `needs_audit`（未逐一联网核验来源）；review `blocked_external`（专业审校 unavailable、真实模型/生产为外部依赖）。**无任何一项或模块标 verified，未臆造来源、审校或学习效果。** evidence 列写客观数字，blocker/next_action 按学科原生缺口与 P 阶段给出，snapshot 引用统一指向最新包。

### #29 / C02 语义核验后端核心（已提交 40bac6d）
- 新增 `course_checks/semantic_suites.py`（standard `code-semantic-suite-v1`，provenance `server_deterministic_checker`）：
  - 多输入：每套件分 `visible`（学习用，对学生可见）与 `independent`（服务端保留、不进公共 manifest、不随提交下发）两组用例，逐用例在隔离 worker 真实运行。
  - 受信独立 oracle：`ORACLES` 为服务端白名单**纯函数**（无 eval/exec、非用户上传）；当前仅注册 `parking_fee_three_tier`（CS01-M03-O03 三级停车费，端点 ≤30→0、≤60→5、>60→10，规则据活动题面与 reference_answer 确证）。oracle 与套件绑定解耦：oracle_id 通用，SUITES 绑定具体不可变活动版本。
  - 六种比较器接受替代正确解：exact / integer（容忍首尾空白、拒绝 "5.0"）/ number_tol / token_multiset（Counter 计重复）/ line_set / sorted_lines；未知 mode 抛 ValueError。
  - 反硬编码：visible 全过而 independent 有 not_met → `suspected_hardcoding=True` 且 fixed_condition=not_met，理由含“硬编码”。
  - 环境安全：environment_error / phase=cleanup / truncated / runner 抛异常 / request_sha256 不符 → 该用例及 fixed_condition 一律 needs_review，**绝不降级为学生错误**；编译/运行时/超时/资源限制判 not_met 并中文区分。
  - 结论克制：explanation、independent_transfer 恒 needs_review（独立用例全过也仅称“有限用例”），mastery_asserted 恒 False；输出含每用例 expected/observed 反例、comparator、oracle_id、scope_note、representative_result（首个可见用例真实 CodeResult）。
- 接线：`schemas.py` 新增 `CodeSuiteRef`（仅 course/activity/objective，**无 task_code、无 stdin**），`CodeSubmission.task` 改 `CodeTaskRef | CodeSuiteRef | None`；`guests.py` 入队前 `get_suite` 校验（未知/版本不符 404 `SEMANTIC_SUITE_UNAVAILABLE`、语言不符 400 `SEMANTIC_SUITE_LANGUAGE`，均不入队），`_run_code` 增 suite 多 case 分支并在结果放 `suite_assessment`；`responses.py` 新增 `CodeSuiteCase/CodeSuiteAssessment` 与 `CodeOperationResult.suite_assessment`；已重生成 `packages/contracts/openapi.json` 与 `api.generated.ts`。
- 测试 `tests/test_semantic_suites.py` **13 passed**：比较器/替代格式、可见用例不暴露独立输入、未知套件 404、正确通用程序全过、端点逻辑错误（< 与 <=）反例、样例硬编码被独立输入抓出、编译/运行时/超时三类学生失败、环境故障 5 情形不降级、语言不符 400，以及 3 个 GuestLeaseStore 活路径（8 次真实 worker 调用覆盖 2 可见+6 独立、硬编码标记、未知套件在 worker 运行前 404）。
- 验证：ruff 全过；后端全量 **446 passed/58 skipped/0 failed**；前端 typecheck 0（union 变化未破坏既有 CodeTaskRef 调用）。

### #29 / C02 公共发现机制（已提交 ae6ce27）
- 事实源确认：前端课程活动来自各课包 `content/courses/CSxx/CSxx-core-practice-<ver>/manifest.json`（vite `import.meta.glob`，见 `course-packages.ts:67`）；`catalog.json` 仅课程级目录（无 activities），`scope-catalog.json` 由 `tools/build_course_scopes.py` 从 catalog 合成（activities 为空）。
- `course_packages.py` 的 Activity 模型（`extra="forbid" strict`）新增 `semantic_suite: PublicSemanticSuite | None`：`PublicSemanticSuite` 含 standard_version/oracle_id/comparator/language/visible_cases/independent_case_count/scope_note；`PublicSemanticCase` 仅 code+stdin。**靠 extra=forbid 天然拒绝 expected_stdout / independent_cases 等私有字段**；validator 限定仅 code 活动可携带、language 须与 code_request 一致、可见用例 code 唯一。
- 用 TEMP 脚本（先断言 course/activity version id 与注册表一致）给 CS01 0.9.0 manifest 的 `CS01-M03-O03-CODE` 写入发现块（visible-30 "30\n"、visible-60 "60\n"，independent_case_count=6，无 expected、无独立输入）。
- 新增 `tests/test_semantic_suite_contract.py` **5 passed**：包校验通过；公告与注册表逐项一致（含独立输入 stdin 不出现在 manifest）；注册表每个套件都必须在某公共包被声明（发现闭环）；manifest 无法夹带 expected/independent（extra forbid）；非 code/语言不符被拒。

### #29 / C02 云同步协议收口（已提交 cf25381）
- `ImportedCodeResult(CodeOperationResult)`（sync_schemas.py，extra forbid strict）经继承已含 suite_assessment，CodeAttempt 复用 codeAttempts 表存整个 CodeResult JSON → **无需 Dexie schema 迁移**。
- `responses.CodeSuiteCase` 的 expected_stdout/observed_stdout 加 `max_length=8192`（与 CodeResult.stdout 同界；已重生成 openapi.json，maxLength 不改变 TS 类型，api.generated.ts 无 diff）。
- `CodeAttemptPayload.bind_work` 增套件分支：禁止 task_assessment 与 suite_assessment 并存；套件要求 learning.context.taskCode=="semantic-suite"、course/activity/objective 与冻结上下文绑定、provenance=server_deterministic_checker、standard=code-semantic-suite-v1、mastery_asserted 恒 False、非 fixed_condition 的 criteria 必须 needs_review。
- `tests/test_code_attempt_sync.py` 新增 `test_imported_semantic_suite_binds_context_and_never_grants_mastery`（跨 activity/objective、错误 taskCode、context=None、解释判 met、mastery True、provenance/standard 篡改、双 assessment 并存等均拒绝）；该文件 **3 passed**。

### #29 / C02 剩余前端全链路（下一工作包，未开始）
关键落点（已侦察，先 Read 再改）：
1. `apps/web/src/domain/course-packages.ts`：`CourseCodeActivity`（line 8-15，已有 check_version）加 `semantic_suite?` 公共类型（形状对齐 PublicSemanticSuite）。
2. `apps/web/src/api/verification.ts`：`runCode`（line 87-136，第三参 task?: CodeTaskRef）扩展接受 CodeSuiteRef；仿 line 117 的身份/版本/mastery 闸门，对返回的 `suite_assessment` 做 course/activity/objective、standard、provenance、mastery 严格校验，不符即判不可信。
3. `apps/web/src/ui/CodeWorkspace.tsx`（164 行）：套件活动（activity.semantic_suite 存在）增**独立于固定题**的“独立语义核验”入口（对选中的已保存 revision 触发）；套件 attempt 用独立 activityKey（如 `${activity.version_id}:semantic-suite`）、learningContext.taskCode="semantic-suite"、复用同一 artifactId；结果区渲染汇总（通过/疑似硬编码/未通过/环境待复核）、可见用例通过情况、**独立用例只显示数量与通过/失败、绝不显示 stdin**、criteria 与 scope_note、硬编码警示；严格沿用现有 small-tag/button/details 样式与设计稿。
4. `apps/web/src/domain/code-assessment.ts`：平行新增 `hasCodeSuiteBinding`（校验 result.suite_assessment 与 context/工件绑定、standard/provenance/mastery、criteria 三项），`codeObjectiveState` 与 `currentCodeAssessment`（或新增套件选择器）把套件 fixed met 计入客观状态（仍只到 partial，解释/迁移待复核）。
5. `apps/web/src/ui/Evidence.tsx`（code 区）与 `ui/Atlas.tsx`（codeObjectiveState 聚合）认套件结果；套件证据展示多 case 结论与硬编码警示，独立用例不显示输入。
6. 本地导出/恢复：`local/database.ts`、`local/LocalSpace.tsx`（exportSpace）、`local/LocalProvider`、`sync.ts` 复用 codeAttempts（result 整体 JSON，已含 suite_assessment）；核对恢复信任判定不能只看 task_assessment，套件结果按 hasCodeSuiteBinding 判定，跨账号/迟到结果不误归属、不升级掌握。
7. 验证：`npm --prefix apps/web run typecheck`、`vitest --run`（为 hasCodeSuiteBinding/verification 校验加单测）、Playwright e2e（CS01-M03-O03：正确通用程序多 case 通过、端点 bug 反例、样例硬编码被独立输入抓出、环境故障不判错）；最后 WSL 真实 isolate worker 多 case e2e（box 701 或串行，勿与开发 worker 共用 box 700）。
- **无需 Dexie 迁移、无需新本地表**（已查明）；前端 sync.ts 透传整个 CodeResult，主要工作是恢复信任判定兼容套件。

## #29 / C01 数据驱动课程包：切片 A、B 已闭环

### 切片 A — 服务端受信核验配置侧车（已提交 dd4e976）
- 目标：教师/课程侧只能下发**受校验的配置与模板引用**，不能成为上传任意评分 Python 的入口；固定条件与语义套件从代码白名单解耦为"随课程包版本绑定的服务端私有侧车"。
- 新增 `services/backend/src/vault_backend/course_checks/server_checks.py`：纯数据模型 `ServerExpectations(course_id, course_version_id, course_code, fixed_conditions[], semantic_suites[])`，pydantic `extra="forbid"`（拒绝任何夹带字段/可执行路径/checker 文件路径）；`DynamicCheckRegistry` 从与公共 manifest 同目录的私有侧车 `server-expectations.json` 加载，键为 `(course_version, objective, task)` / `(course_version, objective)`，未命中或版本/活动不符返回 None。
- 接线：`content.py` 加载包时配对读取侧车到 `server_expectations`（**绝不随公共目录/版本端点下发**）；`guests.py` GuestLeaseStore 增可选 `check_registry`，`_resolve_suite/_resolve_task` 先查动态注册表、未命中回落内置 semantic_suites/code_tasks（向后兼容）；`api.py` create_app 装配 `DynamicCheckRegistry(content.server_expectations)` 与既有 AlgebraRegistry。
- 测试 `tests/test_server_checks.py` **15 passed**：schema 拒绝额外字段/可执行路径、版本与活动不匹配拒绝、固定条件与套件解析命中/未命中回落、动态优先于内置、侧车不进公共响应。后端全量 461 passed。

### 切片 B — 非 CS 编号合成课 + extra_courses 三分区（已提交 0202dd7）
- 目标：用一个**不叫 CS01–CS13 的合成课**证明课程能力与编号/固定 UUID 白名单无关，且不污染"默认 13 课"的公开目录与 13 课专属审计。
- 新增确定性构建器 `tools/curriculum/build_synthetic_workshop.py`（uuid5 幂等、可重复运行、utf-8）：生成课程 `WORKSHOP`「工具复用演练工坊」（course_id `edae7136-15e1-5187-84b3-ff83546eabf7`、version `WORKSHOP-core-0.1.0`、course_version_id `5e2529be-14ed-56a6-9190-71158a22d80e`），2 章 2 目标：
  - `WORKSHOP-M01-O1` code 活动「把分段计费改写成读取输入的通用程序」：固定条件 base（stdin "60\n"→stdout "5\n"）+ 复用白名单 oracle `parking_fee_three_tier`（integer 比较器，c17）的语义套件；visible=30/60，independent=31/61（服务端私有）。
  - `WORKSHOP-M02-O1` finite_algebra 活动「逐公理检查有限运算表」（初始表 [[0,1],[1,2]]），复用数据驱动 AlgebraRegistry，零白名单改动。
  - 公共 manifest 3 条 authority_checked sources（wg14-n1570 取自 CS01 0.9.0；milne-group / auburn-algebra-native 取自 CS05 0.2.0）；私有 `server-expectations.json` 含 1 固定条件 + 1 套件。
- **scope-catalog.json 三分区**：`courses` 恒为 CS01–CS13（公开默认目录，测试断言 13/366）、`extra_courses`=[WORKSHOP]（额外已发布包，加载用于执行但不进默认目录）、`archived_courses`=31（不动）。
  - 后端 `content.py`：加载 extra_courses 用于执行；`get_scope_catalog()`（即 `GET /api/v1/course-scopes`）按 catalog.json 默认 code 集合过滤，公开目录实测 **13 课 / 366 目标 / 无 WORKSHOP / 无 package_path**，而 WORKSHOP 包经版本端点仍可访问执行（2 目标 2 活动）。
  - 前端 `domain/course-packages.ts`：`loadCoursePackage/loadCodeActivity/loadAlgebraActivity` 的查找 entries 合并 `extra_courses`；`ui/Atlas.tsx` 数据驱动构造 `atlasCourses`（默认课程 + extra_courses），课程下拉/查找无硬编码编号，WORKSHOP 自动出现并可加载。
- 新增 `apps/web/e2e/synthetic-workshop.spec.ts` **3 测试**：①atlas 出现并能选中加载（2 目标）；②通用 scanf 程序经侧车独立输入 2/2 通过、独立用例不泄露；③只匹配 30/60 的硬编码被独立输入抓为 suspected_hardcoding。**chromium 3/3、mobile 3/3**（真实 worker）。
- 过程修复：e2e 套件时序——CodeWorkspace 在固定运行开始前就 setSelected 导致套件按钮过早 enabled、并发同租约卡死；saveRevision 改为等"运行结果已保存到这一版代码。"再触发套件。诊断用的临时脚本/调试 spec 已删除。
- 验证：后端 461 passed/58 skipped（三分区改造后三个"13 课专属审计"恢复绿：test_api scope 目录 13/366、test_course_packages courses 集合恰 CS01–CS13、build_coverage_ledger 只遍历默认 courses）；前端 typecheck 0、vitest 107；ruff 全过。

### C01 三个收尾子项的审计与处置（提交 98e3e10）
- **① 一目标多活动 / 一活动覆盖多目标**：脚本扫描全部 32 个 practice 包（13 课 + WORKSHOP），**一目标多个同类 practice_ready 活动 = 0、一活动覆盖多目标 = 0**，故前端 `.find` 首匹配当前无歧义。后端侧车本就 fail-closed（单包内同键固定条件/套件重复即 ValueError；固定任务按 task_code 已支持一目标多任务；活动按 objective_codes 数组已支持覆盖多目标）。新增两类回归测试把隐式假设锁成 CI 契约：`test_each_objective_has_at_most_one_practice_ready_activity_per_kind`（全包扫描，未来出现一目标多活动即红灯并提示先做端到端活动选择器）、`test_duplicate_or_uncovered_sidecar_binding_is_rejected`（重复固定条件/重复套件/绑定到活动未覆盖目标均拒绝，4 参数）。**多活动选择 UI 不在无数据时预先实现（YAGNI），随 C07 教师课出现真实数据时连同契约一起做。**
- **② 新版本归档旧版本、旧记录按旧版本打开**：既有测试 `test_scope_upgrade_preserves_explicitly_archived_course_version` 已锁定契约（新版本成为当前目录、旧版本仍可按 (id,version) 精确打开、归档不污染当前目录）；本次用真实数据复核 scope-catalog 的 **31 个 archived_courses 包文件 0 缺失、get_version 31/31 可达、0 泄漏进公开 scope 目录**；前端学习/证据链接均带 `?courseVersion=<id>`，`CourseCodeWorkspace` 据此经 loadCode/AlgebraActivity（versionId 时纳入 archived_courses）打开旧版本。**读取/打开链路闭环；"发布新版本自动归档旧版本"的写入自动化归 C07 发布管线（当前无发布入口，不虚构）。勿重跑 tools/build_course_scopes.py。**
- **③ 编号 / UUID 白名单审计**：后端残留的 CS01–CS13 硬编码仅三类，均不阻断数据驱动新增：(a) `course_checks/generic_rules.py`（740KB 构建期冻结的旧固定规则/UUID，仅作 DynamicCheckRegistry 未命中的回落，合成课**零改动该文件**即获核验）；(b) 内置工程样例（CS03 stack-example / CS05 logic-example 与其 sync Literal）；(c) `course_blueprints.py` 默认目录"须恰含 CS01–CS13 各一"的平台不变量校验。新增课程主路径已与编号/UUID 无关（切片 B 实证）。**把 13 课冻结规则逐课迁移到侧车、下线 generic_rules 属 #31 各课深化，不在 C01 切片贸然删除（会破坏 366 目标现状与 461 测试）。**
- 教师/自建课上传管线本身在 C07；切片 A 已用 schema（extra=forbid）+ 测试强制"侧车不接受可执行代码/checker 路径/任意 oracle"。
- **C01 公共工程核心判定闭环**：受信配置入口（切片 A）+ 编号无关能力实证（切片 B 合成课）+ 分发契约与归档（本节）；后端全量 **466 passed/58 skipped**、ruff 全过。残留项均已显式归到 C07 / #31 并有契约测试守护。

## C02 语义核验：已完整闭环（前后端 + 真实 worker e2e）

- 后端三层（核心 `40bac6d` / 发现 `ae6ce27` / 同步收口 `cf25381`）+ 前端全链路 `2d8c317` + 代表结果 hash 绑定修复 `e3aec9c` + 前端单测与 Playwright `a153607`。
- 前端：套件发现类型、`runCode(CodeSuiteRef)` 严格闸门、CodeWorkspace 独立“独立语义核验”动作（独立 activityKey/task=`semantic-suite`，复用同一 artifact）、Evidence 专属证据、Atlas 客观状态聚合（套件优先、上限 partial）、本地保存闸门（套件/固定互斥）、导出/恢复经 codeAttempts 整表 JSON（恢复恒 client_reported 不授权，无 Dexie 迁移）。独立用例**只显示聚合计数**，绝不渲染其 stdin/expected/observed/case_code。
- 验证证据：后端 `pytest test_semantic_suites.py + test_semantic_suite_contract.py = 18 passed`、ruff 通过；前端 `typecheck=0`、`vitest 107 passed`；新增 `apps/web/e2e/semantic-suite.spec.ts` 经**真实 WSL isolate worker（8091/box700）编译运行**，chromium 与 mobile 各 2/2：通用 scanf 程序 2 visible+6 independent 全过且不泄露隐藏输入；只匹配 30/60 的硬编码被判 suspected_hardcoding（独立 2 过/4 败）。
- 关键修复：套件代表结果原先回传的 `request_sha256` 含服务端注入的 case stdin，与前端作品快照 hash 天然不等而被一致性闸门拒绝；已改为绑定提交作品请求 hash（case 级 runner 完整性仍在 run_suite 内逐 case 校验），并加 lease 路径断言。
- 既有 e2e 失败（与 C02 无关，已用 C02 前端改动前基线 `7b6da20` 同跑复现）：`learning.spec.ts:36`（atlas `.map-point.is-external`）、`accounts.spec.ts:77/103/123`（账号/邮件/跨设备恢复流）共 4 项，在 C02 改动前后均失败，留待账号/图谱专项排查，不计入 C02。

## 在改文件 / 工作区

- C01 切片 A/B 与 C02 全部改动已提交并推送（HEAD=0202dd7）。工作区仅剩未跟踪 `services/backend/backend-run.txt`（旧本机日志，RUNBOOK 要求不提交、不删除）。
- **推送已恢复**：`git push mine HEAD:hyx_dev` 成功（`7b6da20..0202dd7`）；未强推、未擅合 main。

## 运行中的服务与端口（完成后保持运行）

- PG：Docker 容器 `vault-development-postgres-1`，127.0.0.1:5442，dev 库 vault_dev（head 0012），测试库 vault_ci。
- WSL isolate worker：systemd `vault-code-worker.service`，127.0.0.1:8091（已加载新 /v1/health）；保活靠后台 `wsl -d Ubuntu -u root -- tail -f /dev/null`。
- 后端：127.0.0.1:8000（venv 解释器启动，已加载 extra_courses 三分区与受信侧车，AUTH=true，连 PG，配 worker；health ready、isolated_execution_healthy=true）。日志 `%TEMP%\vault-backend-out6.txt` / `-err6.txt`，mail capture `%TEMP%\vault-mail-capture`。注意须用 `services\backend\.venv\Scripts\python.exe`（系统 python 无 uvicorn），杀进程用 `taskkill /F /T /PID`。
- 前端：127.0.0.1:5176（vite，日志 `%TEMP%\vault-web.txt`）。设计稿预览可用 5177。
- 关键 env 与启动方式见交接包 `RUNBOOK.md`；WSL worker token 必须用 `wsl base64 -w0 /etc/vault-code-worker.env` 在 PowerShell 解码，切勿内联 bash `$VAR`。

## 未解决问题 / 外部限制

- **推送已恢复**：本会话全部提交已推送到 `mine/hyx_dev`（HEAD=d1c0816）。此前 github.com:443 多次超时为国内网络瞬时问题，未换写法绕过、未强推、未擅合 main。
- 58 个 Linux/isolate 测试在 Windows 跳过；需在 WSL 按 RUNBOOK 第 5 节补跑（CS05 120 份工件，作者测试与开发 worker 不可共用 box 700，宜 fixture 指定 701 或串行）。
- 合并 main 始终未授权（feature 分支不计 GitHub 贡献热力图）；需用户确认邮箱已验证后授权 push hyx_dev:main 或开 PR。
- 真实专业审校、真实多模型密钥、生产部署为外部不可得条件；Q4/Q5 与真实模型联调须如实保留，不得伪造签署或删目标降标准。

## 下一条具体任务

**C02 已完整闭环；C01 公共工程核心闭环（切片 A=dd4e976、切片 B=0202dd7、分发契约与归档=98e3e10，详见上文"C01"节）。当前在 #29 / P1，下一项做 C03，再按依赖推进 C04–C08：**

1. **C03 证据/帮助/独立变体/恢复矩阵（紧接）**：多数绑定/不可覆写/恢复不授权已在 code/trace/algebra + C02 套件落地；按 MODULE_WORKBOOK 逐活动核对四类缺口——①证据页是否完整呈现固定/独立/解释各维；②帮助快照（helpViewed/disclosureVersion）是否随结果冻结；③每目标是否有独立迁移变体（不止固定 stdout）；④跨账号/迟到结果/导入证据不误归属、不升级掌握。CS03 栈单元 U01–U05 此前已闭环可作模板。
2. 此后按 `EXECUTION_PLAN.md` 推进 C04 审阅流（E07 审阅与异议；无真实审阅者不得显示"已安排教师"/自动签名）、C05 工具生命周期（E03 SQL PG18/E04 Linux/E05 containerlab 首任务 A—R—B 回程路由/E06 python313ml）、C06 四职责多模型+教学 Skill（LangGraph，密钥后端保存脱敏导出，无密钥用夹具，如实 blocked_external）、C07 教师/自建课/RAG（含发布新版本自动归档、一目标多活动选择 UI、服务端按主体+可见性过滤）、C08 五类先修桥接（BR-JAVA/CPP/PY/MATH/SHELL，不计入 13 课分母）。
3. C01 残留均有归属与契约守护：多活动选择 UI + 发布自动归档在 C07（出现真实数据/发布入口时做，契约测试会红灯引导）；13 课冻结规则逐课迁移侧车、下线 generic_rules 在 #31。
3. 每项贯穿公共包/API/结果 union/本地表+Dexie/同步/权限/证据页/图谱/导出/恢复（参照 #27 algebra_attempt 覆盖清单）；每闭环一项立即提交并 `git push mine HEAD:hyx_dev`，同步更新 TASK_BOARD 与本文件。
4. 无专业审校、无真实模型密钥时完成工程与测试，但 Q4/Q5/真实联调如实保留 blocked_external，不伪造签署、不删目标、不降标准。
5. 既有 4 个 e2e 失败（learning.spec.ts:36 图谱 external 点、accounts.spec.ts:77/103/123 账号长链路）已基线证实与 C01/C02 无关，留待图谱/账号专项；58 个 Linux/isolate pytest 在 Windows 跳过，需 WSL 补跑。
