# 执行进度（EXECUTOR_PROGRESS）

> 接续 `document/handoff/13-course-delivery-2026-10-10/` 交接方案。本文件由执行体持续维护，供跨会话/交回 Codex 接续。只记录已验证事实，不写“全部完成”。

## 当前检查点

- 更新时间：2026-10-11（#29 / P1 进行中：C02 语义核验后端核心已闭环并提交）
- worktree：`C:\Users\Remote\.codex\worktrees\485f\Vault`（detached HEAD）
- HEAD：`40bac6d`；远端 `mine/hyx_dev = 8db1533`（https://github.com/hhyxx1/Vault.git）
- **待推送**：`ae5fb1b`、`c6988fe`、`51f165a`、`9117abd`、`40bac6d` 五个提交尚在本地；github.com:443 仍连接超时/Connection reset（国内网络瞬时问题，#26 曾推送成功）。网络恢复后执行 `git push mine HEAD:hyx_dev` 一条命令推送全部，勿换写法绕过。
- 本次新增提交（新→旧）：
  - `40bac6d` feat(checks): C02 trusted semantic code suites with independent inputs（#29/C02 后端）
  - `9117abd` docs(handoff): close P0（进度检查点）
  - `51f165a` chore(audit): calibrate 122-module task board from latest packages（#28）
  - `c6988fe` feat(evidence): surface native finite-algebra attempts on the evidence page（#27）
  - `ae5fb1b` docs(handoff): executor progress checkpoint（本文件初版）
  - `8db1533` feat(health): split isolated execution configured, healthy and production-ready state（#26，已推送）

## 任务板状态（#23–#32）

- #23 completed — 迁移/Dexie/契约/CS05 包身份/测试库指向核对（head=0012_algebra_attempt，Dexie v10，CS05 0.2.0 三 finite_algebra 活动）。
- #24 completed — 服务栈启动并探活：PG 5442、WSL isolate worker 8091、后端 8000、前端 5176。
- #25 completed — CS05 收尾测试全部复现（证据见下）。
- #26 completed — health/ready 的 isolated_execution 不再写死 false，拆分为 configured / healthy / production_ready 三独立字段，并新增 worker 侧认证健康探针。
- #27 completed — algebra_attempt 全站覆盖复核；唯一缺口（学习证据总页未展示代数实验）已补齐并加 e2e。
- #28 completed — 逐课只读审计并校准 TASK_BOARD.csv：122 模块全 in_progress、source needs_audit、review blocked_external，无一项 verified。
- #29 in_progress（**P1**）— 公共工程 C01–C08。**C02 语义核验后端核心已完成并提交 `40bac6d`**（多输入+受信独立 oracle+替代正确解+反硬编码+环境故障不降级，13 测试，全量 440/58）；C02 端到端（服务端发现、前端触发/展示、证据落库与同步、真实 isolate 多 case）与 C01、C03–C08 待续。
- #30–#32 pending — P2 CS05 其余原生模块+CS03 回填+五类桥接；P3–P5 其余 10 课；P6–P7 教师/自建课/RAG/多模型/Skill 与全面验收、UI 对照、最终报告。

## 已完成项与真实证据

### 环境恢复（P0）
- 后端 venv 基础解释器曾整体丢失（`.venv\pyvenv.cfg` 指向的 `C:\Users\Remote\AppData\Local\vault-python-runtimes\cpython-3.13.16-windows-x86_64-none` 不存在）。用 uv 0.12.22（`C:\Users\Remote\AppData\Local\Temp\vault-uv-tools\bin\uv.exe`）以 `UV_PYTHON_INSTALL_DIR=...\vault-python-runtimes` 重装 CPython 3.13.16 到原路径，venv 复活且 site-packages 保留。
- Docker Desktop/WSL 启动后 PG 容器完成崩溃恢复；WSL `vault-code-worker.service` active，监听 127.0.0.1:8091。
- 共享 pytest 临时目录 `%TEMP%\pytest-of-Remote` 权限损坏（WinError 5，疑似 WSL root 侧运行污染），导致 82 个 setup error。**后续所有后端 pytest 必须带专属 `--basetemp=%TEMP%\vault-pytest-<名>`**。

### 测试基线（2026-10-11 复现，原始日志已归档到 `document/course-reviews/test-runs/`）
- 后端含 PG 全套：**440 passed / 58 skipped / 0 failed**（C02 后基线；P0 末为 427/58，C02 新增 13 个语义套件测试）。58 skipped 为 Windows 主机上的 Linux/isolate 专用测试。
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
- 验证：ruff 5 文件全过；后端全量 **440 passed/58 skipped/0 failed**；前端 typecheck 0（union 变化未破坏既有 CodeTaskRef 调用）。
- **尚未接（下一增量）**：① 服务端/课程包下发“该目标有受信语义套件”的发现元数据（前端不得硬编码 UUID；manifest 只能声明可用性与可见用例，独立输入/期望绝不进 manifest）；② 前端 runCode 支持 CodeSuiteRef、CodeWorkspace“独立语义核验”入口与多 case/硬编码结果渲染（严格按设计稿）；③ suite_assessment 计入本地 codeAttempt 表+Dexie 迁移、云同步 union、证据页/图谱/导出/恢复（现 sync_schemas.py 仅认 result.task_assessment）；④ WSL 真实 isolate 多 case e2e。

## 在改文件 / 工作区

- C02 增量已全部提交（40bac6d）。工作区仅剩未跟踪 `services/backend/backend-run.txt`（旧本机日志，RUNBOOK 要求不提交、不删除）。无其它未提交改动。

## 运行中的服务与端口（完成后保持运行）

- PG：Docker 容器 `vault-development-postgres-1`，127.0.0.1:5442，dev 库 vault_dev（head 0012），测试库 vault_ci。
- WSL isolate worker：systemd `vault-code-worker.service`，127.0.0.1:8091（已加载新 /v1/health）；保活靠后台 `wsl -d Ubuntu -u root -- tail -f /dev/null`。
- 后端：127.0.0.1:8000（已加载新 health 逻辑，AUTH=true，连 PG，配 worker）。日志 `%TEMP%\vault-backend-out.txt` / `-err.txt`，mail capture `%TEMP%\vault-mail-capture`。
- 前端：127.0.0.1:5176（vite，日志 `%TEMP%\vault-web.txt`）。设计稿预览可用 5177。
- 关键 env 与启动方式见交接包 `RUNBOOK.md`；WSL worker token 必须用 `wsl base64 -w0 /etc/vault-code-worker.env` 在 PowerShell 解码，切勿内联 bash `$VAR`。

## 未解决问题 / 外部限制

- **5 个本地提交（ae5fb1b/c6988fe/51f165a/9117abd/40bac6d）待推送**：github.com:443 多次超时/Connection reset；网络恢复后 `git push mine HEAD:hyx_dev` 一条命令推送全部，勿换写法绕过。
- 58 个 Linux/isolate 测试在 Windows 跳过；需在 WSL 按 RUNBOOK 第 5 节补跑（CS05 120 份工件，作者测试与开发 worker 不可共用 box 700，宜 fixture 指定 701 或串行）。
- 合并 main 始终未授权（feature 分支不计 GitHub 贡献热力图）；需用户确认邮箱已验证后授权 push hyx_dev:main 或开 PR。
- 真实专业审校、真实多模型密钥、生产部署为外部不可得条件；Q4/Q5 与真实模型联调须如实保留，不得伪造签署或删目标降标准。

## 下一条具体任务

**当前在 #29 / P1，C02 后端核心已提交（40bac6d）。下一步把 C02 做端到端，并按依赖推进 C01、C03–C08：**

1. **C02 端到端（紧接）**：① 课程包活动声明受信语义套件的发现元数据（仅可用性/comparator/可见用例，独立输入与期望绝不进 manifest），重生成 catalog 静态 JSON 并加内容契约测试，后端以注册表为权威（manifest 谎报则 404）；② 前端 `runCode` 支持 CodeSuiteRef、CodeWorkspace 增“独立语义核验”入口并渲染多 case 通过/反例/硬编码警示（严格对齐设计稿，独立用例不展示输入）；③ suite_assessment 接入 codeAttempt 本地表 + Dexie 迁移、云同步 union（sync_schemas.py 现仅认 task_assessment）、证据页/图谱/导出/恢复，跨账号/迟到结果不误归属；④ WSL 真实 isolate worker 多 case e2e（box 701 或串行）。
2. 此后按 `EXECUTION_PLAN.md` 推进 C01（数据驱动课程包/发布 + 不叫 CS01–13 的合成课，验证能力不依赖编号/固定 UUID）、C03（证据/帮助/独立变体/恢复矩阵）、C04 审阅流、C05 工具生命周期、C06 多模型/Skill 不提权、C07 教师 RAG 仅检索可见资料、C08 五类先修桥接。
3. 每项贯穿公共包/API/结果 union/本地表+Dexie/同步/权限/证据页/图谱/导出/恢复（参照 #27 algebra_attempt 覆盖清单）；每闭环一项立即提交并尝试 `git push mine HEAD:hyx_dev`（先把滞留 5 个提交推上去），同步更新 TASK_BOARD 与本文件。
4. 无专业审校、无真实模型密钥时完成工程与测试，但 Q4/Q5/真实联调如实保留 blocked_external，不伪造签署、不删目标、不降标准。
