# 执行复核报告（EXECUTOR_FINAL_REPORT）

> 交回 Codex 复核。本报告是**阶段性**报告：本次执行覆盖 P0 收尾（#23–#28，前序会话）与 **#29 / P1 的 C02 语义核验后端三层**（本会话）。**13 门课 / 122 模块 / 366 目标的端到端深化（#30–#32）尚未完成**，不输出“全部完成”的虚假结论。所有数字来自仓库现状或可复现脚本/测试原始日志，未臆造来源、审校、签署或学习效果。
>
- 执行时间：2026-10-11
- 执行工作树：`C:\Users\Remote\.codex\worktrees\485f\Vault`（Codex detached HEAD worktree；主仓 `C:\Project\Vault` 在 hyx_dev，未切换/未重置/未强推）
- 配套进度台账：`document/handoff/EXECUTOR_PROGRESS.md`（持续维护，细节以其为准）
- 交接方案只读目录：`document/handoff/13-course-delivery-2026-10-10/`

---

## 0. 本次范围与结论（先读）

- **已闭环并测试**：C02「语义核验」的**服务端三层**——
  1. 受信语义套件运行时（多输入 + 服务端独立 oracle + 替代正确解比较器 + 反硬编码 + 环境故障不降级），commit `40bac6d`；
  2. 课程包**公共发现**元数据与注册表一致性契约（独立输入/期望绝不进公共 manifest），commit `ae6ce27`；
  3. **云同步协议**对套件结果的绑定/不授权收口（含与固定题互斥），commit `cf25381`。
- **后端测试基线：446 passed / 58 skipped / 0 failed**（P0 末为 427/58；本会话净增 19 个测试函数：13 语义套件 + 5 发现契约 + 1 同步绑定，同步文件原有 2 个并入计数）。ruff 干净，前端 typecheck 0。
- **未做（明确边界）**：C02 的**前端全链路**（触发入口、多 case/硬编码渲染、证据页/图谱/导出/恢复、前端同步）与 **WSL 真实 isolate 多 case e2e** 尚未开始；C01、C03–C08 公共工程与 #30–#32 的 13 课深化均未开始。当前唯一注册的受信套件仅 **CS01-M03-O03** 一个目标，属“机制打通 + 一个样板”，**不代表 366 目标已具备可靠语义核验**。
- **推送受阻（外部网络）**：本会话 9 个提交滞留本地，`github.com:443` 多次连接超时/Connection reset；未绕过、未强推、未擅合 main。

---

## 1. Git / 工作树 / 归属（对照清单 §1.1）

- HEAD：`aecf1c7`（docs(handoff) 进度）。远端 `mine/hyx_dev = 8db1533`（https://github.com/hhyxx1/Vault.git，身份 hhyxx1 / houmail7159@foxmail.com）。
- 本会话新增提交（新→旧，**均未推送**）：
  - `aecf1c7` docs(handoff): record C02 discovery and sync closure, backend 446 baseline
  - `cf25381` feat(sync): accept and bind imported semantic suite assessments
  - `ae6ce27` feat(content): announce C02 semantic suite in the CS01 package discovery metadata
  - `4dffc3e` docs(handoff): record C02 semantic suite backend milestone
  - `40bac6d` feat(checks): C02 trusted semantic code suites with independent inputs
  - 以及 P0 收尾 `9117abd` / `51f165a` / `c6988fe` / `ae5fb1b`（合计 9 个提交待推送；`8db1533` 已在远端）。
- 工作区：除上述提交外无已跟踪文件改动；唯一未跟踪文件 `services/backend/backend-run.txt`（旧本机运行日志，RUNBOOK 要求不提交、不删除，保持原样）。
- 网络恢复后**一条命令**推送全部：在 worktree 根 `git push mine HEAD:hyx_dev`，推送后用 `git rev-parse --short refs/remotes/mine/hyx_dev` 核实。禁止换写法绕过、禁止强推、禁止擅合 main。

---

## 2. 13 课逐课现状（对照清单 §1.2，数字为脚本现算）

口径：取每课**最新 core-practice** manifest（`content/courses/CSxx/CSxx-core-practice-<ver>/manifest.json`）。目标数 = `objectives` 长度；固定条件核验 = 活动带 `check_version` 的目标数；变体数 = 活动 `variants` 合计；语义套件 = 活动带 `semantic_suite` 数。统计脚本逻辑见本报告 §7（可复现）。122 模块逐行台账以 `document/handoff/13-course-delivery-2026-10-10/TASK_BOARD.csv`（35 列 123 行，带 BOM）与只读审计器 `tools/curriculum/audit_task_board.py` 为准，本报告不删改、不重抄替代台账。

| 课 | 最新 practice 版本 | 目标数 | 固定条件核验目标 | 变体数 | 受信语义套件 | 包 status / 审校态 |
|----|----|----|----|----|----|----|
| CS01 | 0.9.0 | 30 | 30 | 53 | **1**（M03-O03，后端就绪/前端未上线） | structured_validated / unavailable |
| CS02 | 0.2.0 | 24 | 24 | 26 | 0 | structured_validated / unavailable |
| CS03 | 0.2.0 | 30 | 30 | 30 | 0 | structured_validated / unavailable |
| CS04 | 0.2.0 | 27 | 27 | 29 | 0 | structured_validated / unavailable |
| CS05 | 0.2.0 | 30 | 30 | 30 | 0（另有 3 个原生 finite_algebra 活动，见 #27/#28） | structured_validated / unavailable |
| CS06 | 0.2.0 | 27 | 27 | 30 | 0 | structured_validated / unavailable |
| CS07 | 0.1.0 | 27 | 27 | 27 | 0 | structured_validated / unavailable |
| CS08 | 0.1.0 | 30 | 30 | 30 | 0 | structured_validated / unavailable |
| CS09 | 0.1.0 | 30 | 30 | 30 | 0 | structured_validated / unavailable |
| CS10 | 0.2.0 | 27 | 27 | 29 | 0 | structured_validated / unavailable |
| CS11 | 0.2.0 | 27 | 27 | 31 | 0 | structured_validated / unavailable |
| CS12 | 0.2.0 | 27 | 27 | 30 | 0 | structured_validated / unavailable |
| CS13 | 0.3.0 | 30 | 30 | 39 | 0 | structured_validated / unavailable |
| **合计** | — | **366** | **366** | **414** | **1** | 全部 unavailable |

- 目标总数 **366**、模块 **122**，与交接快照 `CURRENT_SNAPSHOT.json`、#28 审计一致，**未静默删减分母**。
- 活动承载：#28 审计口径为 **363 个 code 活动 + CS05-M07 的 3 个原生 finite_algebra 活动 = 366 个目标承载活动**（每目标至少一个 practice_ready 活动）。
- Q0–Q5 门状态（逐课相同，除注明外）：
  - **Q0 结构**：过（包可被 schema 校验、目录/版本/不可变 version_id 齐备）。
  - **Q1 内容主张**：大纲/目标在位，但**来源未逐一联网核验**（source = needs_audit），AI 整理≠专业签署。
  - **Q2 可实践**：活动可在隔离环境运行（code），CS05 三个原生有限代数活动经 e2e 验证。
  - **Q3 可靠核验**：**薄弱**——366 目标目前仅固定条件 stdout/穷举比对（CS01 用 `cs01-fixed-condition-v1`，CS05-M07 用 `finite-algebra-exhaustive-v1`，其余 `code-fixed-condition-v1`）；仅 CS01-M03-O03 升级为受信多输入语义套件，且**前端尚未上线**。这正是 C02 要系统性解决的问题，目前只完成机制与一个样板。
  - **Q4 专业审校**：**blocked_external**（无真实专业审校者，全部 curriculum_review_state=unavailable；C04 不得显示“已安排教师”/自动签名）。
  - **Q5 真实联调/生产**：**blocked_external**（无真实多模型密钥、无生产部署；多模型/RAG 为工程+mock，真实调用门保留）。
- 阻断项：语义核验前端全链路、WSL 真实 isolate 补测、非编程学科原生实操（CS05 网络/DB/OS/组成，禁止打印/模拟冒充）、专业审校与真实密钥（外部不可得）。

---

## 3. 122 模块台账（对照清单 §1.3）

- 逐行状态、证据列、blocker、next_action 全部在 `TASK_BOARD.csv`（#28 由 `audit_task_board.py` 校准）。客观结论：122 模块的 module/theory/activity/check/variant/graph/integration 八项**均 in_progress**（有在位产物但八项未齐、无一闭环）；source 全 `needs_audit`；review 全 `blocked_external`；**无任何模块 verified**。
- 本会话**未新增模块、未改变分母**（122/366 不变）。C02 是横切公共工程（`course_checks/`、课程包 schema、同步协议），不为某一新课凑模块数。
- 图谱 relations 仍稀疏（#28：每课 10–22 条，CS01-M01 关系端点覆盖 0/3），属后续深化项；本会话未改图谱关系。

---

## 4. 本次新增能力：C02 语义核验（对照清单 §1.6 核验器要求）

### 4.1 受信语义套件运行时（`services/backend/src/vault_backend/course_checks/semantic_suites.py`，commit 40bac6d）
- standard `code-semantic-suite-v1`，provenance 恒为 `server_deterministic_checker`。
- **多输入**：每套件分 `visible`（学习用、随题面公开）与 `independent`（服务端保留，**不进公共 manifest、不随提交下发**）两组；逐用例在隔离 worker 真实运行学生提交的同一程序。
- **受信独立 oracle**：`ORACLES` 是服务端白名单**纯函数**（无 eval/exec、非用户上传、经工程审查）；oracle_id 通用、与具体活动版本在 `SUITES` 绑定解耦。当前仅注册 `parking_fee_three_tier`（CS01-M03-O03，c17，integer 比较器；端点 ≤30→0、≤60→5、>60→10）。**注册表硬编码是安全设计而非缺陷**：杜绝“上传任意评分 Python”。
- **替代正确解**：六种比较器 exact / integer（容忍首尾空白、拒绝 "5.0"）/ number_tol / token_multiset（Counter 计重复）/ line_set / sorted_lines。
- **反硬编码**：visible 全过而任一 independent 未过 → `suspected_hardcoding=True` 且 fixed_condition=not_met，理由含“硬编码”。
- **环境故障不降级**：environment_error / phase=cleanup / truncated / runner 异常 / request_sha256 不符 → 用例与 fixed_condition 一律 needs_review，**绝不记为学生错误**；编译/运行时/超时/资源限制判 not_met 并中文区分。
- **结论克制**：explanation、independent_transfer 恒 needs_review（独立用例全过也仅称“有限用例”），`mastery_asserted` 恒 False。
- 接线：`schemas.py` 新增 `CodeSuiteRef`（仅 course/activity/objective，**无 task_code、无 stdin**），`CodeSubmission.task` 为 `CodeTaskRef | CodeSuiteRef | None`；`guests.py` 入队前 `get_suite` 校验（未知/版本不符 404 `SEMANTIC_SUITE_UNAVAILABLE`、语言不符 400 `SEMANTIC_SUITE_LANGUAGE`，均不入队），`_run_code` 增 suite 多 case 分支，结果置 `suite_assessment`，representative_result 取首个 visible 用例真实 CodeResult；`responses.py` 新增 `CodeSuiteCase/CodeSuiteAssessment` 与 `CodeOperationResult.suite_assessment`。

### 4.2 公共发现（commit ae6ce27）
- `course_packages.py` Activity 模型（extra="forbid" strict）新增 `semantic_suite: PublicSemanticSuite | None`；公共块仅含 standard_version/oracle_id/comparator/language/visible_cases（code+stdin）/independent_case_count/scope_note。**extra=forbid 天然拒绝 expected_stdout、independent_cases 等私有字段**；validator 限定仅 code 活动可携带、language 与 code_request 一致、可见用例 code 唯一。
- CS01 0.9.0 manifest 的 `CS01-M03-O03-CODE` 写入发现块（visible-30/visible-60，independent_case_count=6，无 expected、无独立输入）。
- 契约测试 `test_semantic_suite_contract.py`（5 passed）：公告与注册表逐项一致；独立输入 stdin 不出现于 manifest；注册表每个套件必须在某公共包被声明（发现闭环）；夹带 expected/independent 被拒；非 code/语言不符被拒。

### 4.3 云同步收口（commit cf25381）
- `ImportedCodeResult(CodeOperationResult)` 经继承含 suite_assessment；CodeAttempt 复用 codeAttempts 表存整个 CodeResult JSON → **无需 Dexie 迁移/新表**。
- `CodeSuiteCase.expected_stdout/observed_stdout` 加 max_length=8192（与 CodeResult.stdout 同界；openapi 已重生成，TS 类型无 diff）。
- `CodeAttemptPayload.bind_work`：禁止 task_assessment 与 suite_assessment 并存；套件要求 `learning.context.taskCode=="semantic-suite"`、course/activity/objective 与冻结上下文绑定、provenance/standard 正确、mastery_asserted 恒 False、非 fixed criteria 必须 needs_review。
- 测试 `test_code_attempt_sync.py`（3 passed）覆盖跨 activity/objective、错误 taskCode、context=None、解释判 met、mastery=True、provenance/standard 篡改、双 assessment 并存等拒绝路径。

---

## 5. 新工具适配器 / 运行环境（对照清单 §1.4、§1.10）

- 本次**未新增外部工具适配器**（无新语言运行时、无新容器/网络仿真）。C02 复用既有 isolate worker（c17 已支持）。
- 服务运行位置（完成后保持运行）：
  - PG：Docker `vault-development-postgres-1`，127.0.0.1:5442→5432；dev 库 vault_dev（迁移 head 0012_algebra_attempt），测试库 vault_ci。
  - WSL isolate worker：Ubuntu systemd `vault-code-worker.service`，127.0.0.1:8091，box 700；含 Bearer 认证 `GET /v1/health`（#26）。
  - 后端：127.0.0.1:8000（AUTH=true、连 PG、配 worker、allowed origins 白名单含 5173/5176/5178）。
  - 前端：127.0.0.1:5176；设计稿预览 5177（`document/prototypes/knowledge-atlas/serve.py`）。
- 准备/运行/取消/清理/恢复：见交接包 `RUNBOOK.md`；worker token 必须在 PowerShell 用 `wsl -d Ubuntu -u root -- base64 -w0 /etc/vault-code-worker.env` 解码，切勿内联 bash `$VAR`。

---

## 6. 来源账本 / 审校（对照清单 §1.5）

- 本次 C02 唯一的“内容主张”是三级停车费计费规则（端点与费率），取自 CS01-M03-O03 活动题面与其 reference_answer（仓库内既有内容），oracle 据此实现并有端点测试（0/29/31/59/61/120）。**未新增外部引用、未编造页码/出处**。
- 课程级来源仍为 needs_audit（#28）；专业审校全 blocked_external。AI 核对与专业签署严格区分，报告不以后者自居。

---

## 7. 测试：命令、环境、原始结果、工件（对照清单 §1.7）

后端（Windows PowerShell，worktree 根；**必须专属 `--basetemp`**，否则共享 `pytest-of-Remote` 权限报 82 errors）：

```
$env:PYTHONPATH='services\backend\src'
$env:VAULT_TEST_DATABASE_URL='postgresql+psycopg://vault_dev:vault-dev-local-2026@127.0.0.1:5442/vault_ci'
$env:VAULT_TEST_API_DATABASE_URL='postgresql+psycopg://vault_api:ci-runtime-ephemeral-only@127.0.0.1:5442/vault_ci'
$env:VAULT_TEST_DATABASE_IS_DISPOSABLE='1'
services\backend\.venv\Scripts\python.exe -m pytest services\backend\tests -q -p no:cacheprovider --tb=short -rf --basetemp=%TEMP%\vault-pytest-<唯一名>
```

- 全量：**446 passed / 58 skipped / 0 failed**（原始日志 `%TEMP%\t29-b2.txt`；C02 核心 `t29-sem.txt`=13、发现契约 `t29-semc.txt`=5、同步 `t29-sync.txt`=3、内容契约回归 `t29-cc.txt`=22）。
- 58 skipped：Windows 主机上的 Linux/isolate 专用测试，**未在本会话于 WSL 补跑**（如实记为未执行；补测法见 RUNBOOK 第 5 节，box 701 或串行，勿与开发 worker 共用 box 700）。
- ruff：`services\backend\.venv\Scripts\ruff.exe check <files>`（行长 100）全部干净。
- 契约：`python -m vault_backend.export_openapi --output packages\contracts\openapi.json` 已重生成；`packages\contracts\tooling\node generate.mjs` 已跑（api.generated.ts 对 maxLength 无类型 diff）。
- 前端（P0 基线，本会话未改前端源码）：`npm --prefix apps/web run typecheck` = 0 error；vitest = 104 passed / 17 files；CS05 原生 e2e = 6 passed（桌面+移动）。**C02 前端 e2e 未编写/未执行**。
- 逐课统计可复现：遍历最新 practice manifest，递归统计 `objectives`、含 `code_request` 节点、`check_version`、`semantic_suite`、`variants`（临时脚本在执行机 `%TEMP%\vault_course_stats.py`，非仓库文件；数字见 §2）。

---

## 8. UI 设计稿对照（对照清单 §1.8）

- 本会话**未改动任何前端源码、未产生新截图**。既有 UI 与 `document/prototypes/knowledge-atlas/` 设计稿的对照结论沿用前序会话（三栏课程全景、双视图、Evidence 代数区已上线并 e2e）。
- C02 前端必须**严格沿用** CodeWorkspace 既有 small-tag/button/details 视觉语言与设计稿；独立语义核验入口与固定题分开、独立用例**不显示 stdin**。该项未做，不提供“已对照”结论。

---

## 9. 角色 / 自建课 / RAG / 模型 / Skill 边界（对照清单 §1.9）

- 本会话未触及教师/学生/游客新路径、自建课、RAG、多模型、教学 Skill 上传。C02 的安全姿态与后续 C06/C07 一致并已在后端预置：受信 oracle 只能来自服务端白名单（不可由学生/教师上传任意评分 Python）；学生不可经提交读取独立输入/期望；跨账号/迟到结果由既有 client id + request_sha256 + 冻结上下文绑定拦截（同步测试已覆盖套件版本）。
- 真实多模型调用、教师隐私资料 RAG 过滤、Skill 不提权等门在 C06/C07 阶段验收，当前保持 blocked/未实现，不以 mock 冒充真实联调。

---

## 10. 数据迁移 / 旧版本作品 / 回滚 / 恢复（对照清单 §1.10）

- **无数据库迁移**：C02 复用 codeAttempts（活动数据复用 sync_object 多态，无独立 code 表），suite_assessment 是 CodeOperationResult JSON 内的新可选字段，旧作品 result 不含该字段即视为无套件核验，向后兼容。Dexie 无需升版本（#27 algebra 才引入 v10）。
- 回滚：所有改动为独立提交，且未推送；如需回退按提交逆序 `git revert`（勿 reset/clean 主仓）。openapi/TS 为生成物，回滚代码后重新生成即可。
- 备份恢复：PG 为 Docker 卷；测试库 vault_ci 可销毁（DISPOSABLE=1）。服务位置见 §5。
- 待补外部条件：网络恢复后推送；WSL 补跑 58 skipped；真实专业审校/模型密钥/生产（外部不可得）。

---

## 11. 必查错误模式逐条自检（对照清单 §2）

- [x] 未把 `full_course_available=true` 或调分母作为完成手段（未碰该开关；122/366 不变）。
- [x] 122 模块/366 目标未删减；一个套件样板不冒充所有模块（报告明确仅 1 目标升级、前端未上线）。
- [x] 目标承载活动在位（366 practice_ready）；非编程学科未被强迫写代码（CS05 原生 finite_algebra 已在；网络/DB/OS/组成留 C05，禁止模拟冒充）。
- [x] 未将预置字符串/模拟终端/伪造 pcap 当实操（本会话不涉及；C05 红线保留）。
- [x] 检查器接受替代解（6 比较器）、检出硬编码（visible 过/independent 败）与端点遗漏（`<` vs `<=` 反例测试），独立用例服务端核对、不下发。
- [x] 有限测试结论边界正确：独立用例全过仍仅“有限用例”，explanation/independent_transfer 恒 needs_review，不授一般掌握。
- [x] 解释不靠字数/关键词通过；无真实审阅人不虚构排队（C04 未做，红线保留）。
- [x] 看答案/受帮助后不直接标独立掌握；mastery_asserted 恒 False；帮助快照为既有 helpViewed 机制。
- [x] 失败/取消/超时/环境错误分开，环境故障不判学生错误（5 种环境情形测试）；旧成功与新反例均落 cases 留痕。
- [ ] 本地/登录承接/跨账号/跨设备/冲突/撤销/导出覆盖**套件活动类型**：后端同步绑定已做并测试，**前端导出/恢复/UI 全链路未做**（未完成项，不得勾）。
- [x] API 结果绑定真实版本/工件 hash/身份：CodeSuiteRef 绑定 course/activity/objective，result 校验 client ids + request_sha256；未知套件在 worker 运行前 404；迟到/跨账号由既有绑定拦截并新增套件同步测试。
- [x] 客户端恢复结果不自动升级为权威证据：套件同步导入仍要求服务端 provenance/standard 且 mastery False，非 fixed criteria 必须 needs_review。
- [ ] 教师隐私/受限答案不进学生 RAG：C07 未做（留待，不勾）。
- [ ] 自建课复用工具、不按 13 编号硬编码能力：C01 未做；但 C02 注册表按不可变 activity_version_id 绑定、发现由数据包驱动（前端不硬编码 UUID），为该门奠定基础，整体门未达成（不勾）。
- [ ] 多模型真实协议适配、真实/mock 区分：C06 未做（不勾）。
- [ ] 上传/生成 Skill 不改 ACL/不提权/不覆盖检查器/不执行宿主命令：C06 未做；C02 已确保检查器不可被上传覆盖（服务端白名单），整体门留 C06（不勾）。
- [ ] 图谱分母一致/无假边/无邻接传播：本会话未改图谱；套件结果计入图谱客观状态的前端聚合**未做**（不勾）。
- [ ] 同尺寸截图对照/动效可打断/键盘与减少动态：本会话无前端改动（不勾）。
- [x] 未泄露凭据、未提交用户数据、未删其他项目、未强推、未擅改生产（token 仅运行时解码、未写入仓库/日志/提交）。
- [ ] CI 与本地相符、平台跳过项补测：本地后端全绿；**58 个 Linux/isolate 项未在 WSL 补测、C02 前端 e2e 未写**（如实未完成，不勾）。

---

## 12. 交回 Codex 的下一步（按优先级）

1. **C02 前端全链路（紧接，须一次接通，勿留半接 UI）**：`course-packages.ts` 类型 → `verification.runCode` 支持 CodeSuiteRef 并严格校验返回的 suite_assessment → `CodeWorkspace.tsx` 独立“独立语义核验”入口（独立 activityKey、taskCode="semantic-suite"、复用 artifactId）与多 case/硬编码渲染（独立用例不显示 stdin，严格按设计稿）→ `code-assessment.ts` 套件绑定与客观状态聚合 → `Evidence.tsx`/`Atlas.tsx` 认套件结果 → 本地导出/恢复/`sync.ts` 兼容（复用 codeAttempts，无 Dexie 迁移）→ typecheck/vitest/Playwright（正确通用程序、端点 bug、样例硬编码、环境故障四场景）→ WSL 真实 isolate 多 case e2e（box 701/串行）。落点与已查明事实详见 `EXECUTOR_PROGRESS.md` 第“#29 / C02 剩余前端全链路”。
2. 网络恢复后先 `git push mine HEAD:hyx_dev`（推送滞留 9 个提交）。
3. 扩大语义套件注册面：在更多 code 目标按同一注册表/发现/同步机制落地（每个 oracle 都须是服务端白名单纯函数并配替代解/两类错误/硬编码/环境故障测试），推进 C02 出口“固定题与独立题分开”。
4. 按 `EXECUTION_PLAN.md` 推进 C01、C03–C08，再进入 #30–#32；非编程学科坚持原生实操；Q4/Q5/真实联调始终如实 blocked_external。

---

## 13. 复核建议（给 Codex）

先审本会话 4 个 feat/fix 提交的 git diff（执行边界、同步绑定、extra=forbid 私有字段防护、oracle 白名单），再从 CS01-M03-O03 走一条“正确通用程序 / 端点 bug / 样例硬编码 / 环境故障”的后端失败→判定路径（`test_semantic_suites.py` 已自动化）。前端全链路完成后，再按 REVIEW_CHECKLIST §3 抽薄弱模块深审。共享机制若发现问题，应扩大到所有将注册套件的课程，不以单样板替代全目标验收。
