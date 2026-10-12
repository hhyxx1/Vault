# 第二轮可信度返工报告（EXECUTOR_FIX_ROUND2_REPORT）

> 基线 `79a5ec7`。本轮为返工，不扩展课程工作包。**结论：7 项中 5 项完成、2 项部分完成并保留必做缺口；不宣称全部完成。**

## 0. 逐项验收对照

| # | 项 | 状态 | 证据 |
|---|----|----|----|
| 7 | 真实 worker 联调 | **完成** | 根因=WSL 无保活；语义套件 e2e 2/2 通过 |
| 1 | 审阅证据权威来源（后端） | **完成** | `server_verification`(0015) + 服务端重跑 + 伪造负例；`test_reviews.py` 19 passed |
| 3 | 历史 hidden 数据清理 | **完成** | `redaction.py` 在同步存/取 + 审阅冻结统一去敏；往返夹具单测 |
| 4 | 统一版本绑定/环境失败 | **完成** | `suiteVerdictForRevision`(最新+最后有效)+内容校验；vitest 127 |
| 5 | SQL 比较器新问题 | **完成** | inf 符号统一、Hopcroft-Karp、规模上限、容差边界；28 tests |
| 6 | 四维验收统计 | **部分完成** | 统计脚本改为证据驱动、无硬编码零；**CS01 版本迁移未做** |
| 2 | 非代码作品 + 真实师生浏览器 E2E | **未完成** | 后端仍限 `code_attempt`；未新增完整流程浏览器 E2E |

---

## 1. Item 7：真实 worker 联调（完成）

**根因（严谨定位，非“未修改路径也失败就断言无关”）：**
- 后端 `run_code` 返回 `environment_error` / `failure_code=transport_unavailable`。
- 复现路径：在**后端实际使用的 Python（`.venv` 3.13.16）**下，用 `CodeWorkerClient.run()` 直连
  `127.0.0.1:8091` 得到 `httpx.ConnectError('All connection attempts failed')`；而 worker `GET /v1/health`
  与 PowerShell 直连均 200。
- 进一步检查 `systemctl show vault-code-worker.service -p ActiveEnterTimestamp` 发现时间戳**每次都在“刚刚”**，
  journald 显示服务被反复 Stop/Start——即 **WSL 发行版在无进程保活时退出，systemd worker 随之停止**。
  这与 `RUNBOOK.md` 第 2 节“执行 `systemctl is-active` 会唤醒但未必持续保活，需 `wsl … tail -f /dev/null`”一致。
- 结论：不是 DSH 沙箱、不是 Python 子进程网络限制；前一轮“PowerShell 能连、Python 不能”是 worker 已停的假象。

**修复与验证：**
- 启动持久 WSL keepalive（后台 `wsl -d Ubuntu -u root -- tail -f /dev/null`），重启一次 worker。
- 之后 `POST /v1/runs` 直连 200；**后端全链路** `run_code` 返回 `status=success`（stdout `hi\n`），
  `GET /api/v1/health/ready` → `isolated_execution_healthy=true`。
- 隔离真实执行 E2E：`semantic-suite.spec.ts` chromium **2 passed**（含硬编码反例），
  `reviews.spec.ts` chromium **2 passed**。
- 未修改系统 TEMP 权限、未做大范围 ACL 重置。

---

## 2. Item 1：审阅证据权威来源（后端完成）

**问题**：上一轮 `review.py` 仅从 `sync_object`（客户端上传）读取结果并派生 `server_tool`；字段一致性不等于执行真实性。

**修复：**
- **服务端执行台账** `server_verification`（迁移 `0015_server_verification`，owner-bound，RLS owner_only，append-only 触发器）。
  字段含 owner/space/artifact/revision/hash/course/activity/objective/task/checker_kind/standard_version/outcome/detail。
- **服务端重跑**（`review_verification.py::AuthoritativeVerifier`）：审阅提交时服务端用**已同步的源文件**
  经隔离 worker + 受信检查器（固定条件任务或受信语义套件）**重新执行**，据权威结果生成 `server_tool` 证据；
  执行环境不可用→`CODE_WORKER_UNAVAILABLE`（要求重新核验），无可核验配置→`CHECK_UNAVAILABLE`，**绝不把导入结果升级为可信**。
- **不把“已有自动核验结果”作为前提**：`_verified_code_work` 不再要求客户端结果；未运行过的已保存版本也可提交（服务端会重跑）。
- **导入结果保持客户端来源**：冻结快照里上传结果存为 `client_reported_result`（advisory），
  另有 `server_verification`（provenance=`server_execution`）。
- **rubric 来源**：`validate_rubric` 强制与平台/课程标准三维（objective/explanation/independent）完全一致，
  拒绝缺失/重复/多余/维度错配（`RUBRIC_MISMATCH`/`RUBRIC_DUPLICATE`）。
- **冻结快照含学习上下文与帮助**：`learning_context` + 从学生本空间（RLS 限定）读取的 `help_records`；
  教师仅经该 RLS 工单可见。

**测试（`tests/test_reviews.py`，真实 PG，19 passed）：**
- 新增 `test_forged_field_consistent_sync_result_never_gets_server_tool_identity`：
  伪造“met”且字段自洽的上传 → 服务端重跑判 `not_met`，证据显示未通过，导入结果仅 advisory。
- 新增 `test_client_report_without_result_can_still_be_reviewed`（无客户端结果也可审阅）。
- 新增 `test_rubric_must_match_the_platform_standard`（拒绝减少/重复必要条目）。
- 更新 `test_server_tool_evidence_is_derived_from_a_server_run`（证据来自服务端重跑，含 `env.verifier.calls`）。
- 原有完整流程（提交→接单→查看冻结→退回→真实新修订补证→再审签署→异议）继续通过。

**未完成部分**：见 §7 item 2（前端完整流程入口与非代码作品）。

---

## 3. Item 3：历史 hidden 数据清理（完成）

- 新增 `vault_backend/redaction.py::redact_hidden_suite_fields`：在**可信边界**把历史 `independent` 用例的
  `stdin/expected_stdout/observed_stdout` 置空、`case_code` 归一为 `independent-N`、理由改为不含输入的文本；
  visible 用例与公开聚合保持不变，纯函数（不改原对象）。
- 应用点：**同步上传落库**（`sync.py` 持久化 `SyncObject`/`SyncChange` 时去敏并重算存储 hash）、
  **同步下发**（`changes` 响应再次去敏，覆盖去敏前的旧行）、**审阅冻结快照**（`review.py` 的 `client_reported_result`
  与 `_load_synced_code_attempt`）。
- 测试：`test_code_attempt_sync.py` 新增历史夹具 `test_historical_independent_secrets_are_redacted_at_the_boundary`
  （往返后无 stdin/expected/observed/输入泄漏）与 no-op 测试。**不仅依赖前端不显示。**

---

## 4. Item 4：统一版本绑定与环境失败（完成）

- `code-assessment.ts`：`suiteBoundToRevision` 要求**来源修订 id 与内容指纹同时匹配**（legacy 无 id 时按指纹）；
  `suiteRevisionKey` 改为 `(revision, hash)` 复合键；`suiteVerdictForRevision` 返回 `{latest, valid}`：
  **同修订内明文保留最后一次有效结论（met/not_met），同时 latest 环境失败单独呈现**；新修订不继承旧成功。
- `CodeWorkspace.tsx`：结论取 `valid ?? latest`，当同一版本重跑仅环境失败时显示“本次重跑未完成核验（环境原因），
  不计为错误；上方结论保留上次有效核验”。
- 测试：vitest 新增“latest/valid 分离”“来源 id 与内容必须同时匹配”，共 127 passed。

---

## 5. Item 5：SQL 比较器新问题（完成）

- **inf 符号统一**：Decimal/float 无穷统一编码 `(_INF, +1/-1)`（原先 Decimal 用 `is_signed()`、float 用 `>0`，
  符号相反故不等）；测试覆盖正正/负负/正负/负正 × set/multiset/ordered。
- **多项式匹配**：`_perfect_match`（回溯，最坏阶乘）替换为 **Hopcroft-Karp** `_has_perfect_matching`（O(E√V)），
  保持一对一与重复计数语义；高重复近似压力反例（400 行）及时结束。
- **规模上限**：`MAX_RELATION_ROWS/CELLS` 与 `MAX_TOLERANCE_MATCH_ROWS`，超限抛 `ValueError`（非法参数而非静默“不等”）。
- **容差边界**：`_numbers_close` 用 `localcontext` 按操作数量级放宽精度，避免 Decimal 默认上下文舍入误判；
  新增高精度边界测试。
- `test_sql_result_compare.py` **28 passed**（保留类型/NULL/容差/非法参数旧测试）。

---

## 6. Item 6：四维验收统计（部分完成）

- `tools/curriculum/audit_coverage_dimensions.py` 重写为四维、证据驱动：
  - **a 静态结构**：当前发布版本声明的目标数（366）。
  - **b 已有核验机制**：声明了 `check_version` 或 `semantic_suite` 的目标数（366）——仅“机制存在”。
  - **c 实际执行验证**：仅统计在 `document/handoff/course-acceptance-evidence.json` 中有**可追溯执行证据**的目标
    （当前 **1**：CS01-M03-O03，引用 semantic-suite e2e）——**不按 `kind` 推断**。
  - **d 产品闭环验收**：仅统计有闭环证据且 `accepted=true` 的目标（当前 **0**，且**非写死**；无证据显示“未验证”）。
- **未完成**：CS01 0.9.0 版本迁移（把语义核验定义移入新版本、更新目录/注册/测试、证明旧记录打开旧定义）**未做**；
  当前仅确认 0.9.0 manifest 曾在 `ae6ce27` 原地追加 `semantic_suite` 发现块，如实列为已知边界。

---

## 7. Item 2：非代码作品 + 真实师生浏览器 E2E（未完成）

**已具备的基础**：审阅信任边界（item 1）已要求服务端权威执行、rubric 标准、冻结上下文/帮助；
`review_verification.py` 结构已可扩展。

**缺口（如实列出，不总结为完成）**：
1. 审阅入口仍限 `code_attempt`：`_load_synced_code_attempt` 只读 `code_attempt`；
   证明/结构化推演/设计/解释等作品（`structured_attempt`/`course_attempt`/`algebra_attempt`）**尚未接入**。
2. **未新增**“提交→接单→查看冻结→退回→真实新修订补证→再审签署→查看结果+异议”的**浏览器 E2E**；
   现有 `reviews.spec.ts` 仍只有“诚实空态 + 未认证教师门禁”两条，**不能代替**该流程。
3. 前端 `Reviews.tsx` 尚未展示新的 `learning_context`/`help_records`/`server_verification` 冻结明细。

**下一轮精确起点**：先做 (1) 的通用 work 加载与纯函数检查器重跑（结构化/代数/真值表），再加 (2) 的浏览器 E2E
（隔离资格教师夹具），最后 (3) 前端冻结明细展示。

---

## 8. 测试与环境（区分用例数 / 浏览器配置执行数 / 跳过 / 失败）

后端（Windows PowerShell，PG 全套，`vault_ci` head `0015_server_verification`）：

```
$env:VAULT_DATABASE_URL='postgresql+psycopg://…@127.0.0.1:5442/vault_dev'   # 运行库（含 0015）
$env:VAULT_TEST_DATABASE_URL='…/vault_ci'  $env:VAULT_TEST_API_DATABASE_URL='…/vault_ci'
$env:VAULT_TEST_DATABASE_IS_DISPOSABLE='1'
.venv\Scripts\python.exe -m pytest services/backend/tests -q -p no:cacheprovider --tb=line
# → 525 passed, 58 skipped, 0 failed（58 跳过=Windows 上 Linux/isolate 专用用例）
```

- 后端**用例数 525 通过 / 58 跳过 / 0 失败**；其中 `test_reviews.py` 19、`test_sql_result_compare.py` 28、
  `test_code_attempt_sync.py` 5、`test_tool_lifecycle.py` 9。
- 前端：`typecheck` 0 error；`vitest` **127 passed / 19 files**；`contracts:check` 一致。
- 浏览器 E2E（chromium，`--workers=1`，真实后端 8000 + 前端 5176 + WSL worker 8091）：
  `semantic-suite.spec.ts` **2 passed**、`reviews.spec.ts` **2 passed**（均为 chromium 单项目；mobile 未跑）。
- ruff：`services/backend/src`、`tests`、`migrations/versions` 全目录 **All checks passed**。
- 日志/报告中不含密码、密钥或完整敏感连接串（连接串以 `…` 省略）。

---

## 9. HEAD / 推送 / 服务

- HEAD 与推送状态、服务状态见本轮提交后的补齐（§10）。
- 服务（完成后保持运行）：PG 5442（vault_dev/vault_ci 均 head `0015_server_verification`）、
  后端 8000（ready、`isolated_execution_healthy=true`）、前端 5176、WSL worker 8091（active，由 `tail -f /dev/null` 保活）。

## 10. 修订与凭据清理

- 已修订 `document/handoff/EXECUTOR_FIX_REPORT.md` 中“A–E 全部完成”的过度结论，改为按项标注完成/受限。
- `document/handoff/course-acceptance-evidence.json` 只登记可追溯执行证据，无凭据。
- 未在其他文档/服务中发现新增写入的连接凭据；连接串一律以 `…` 省略。
