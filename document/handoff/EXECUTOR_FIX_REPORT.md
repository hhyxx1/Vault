# 本轮可信度问题修复报告（EXECUTOR_FIX_REPORT）

> 基线 `2a220c7`（已推送 `mine/hyx_dev`）。本轮只修复复核发现 A–E 的可信度问题，**不宣布 13 门课交付**。每一项原问题 → 修复方式 → 对应提交 → 测试证据。

## 0. 结论速览

| 项 | 结论 | 关键证据 |
|----|----|----|
| A 隐藏测试泄漏 | 已修复（服务端去敏感，非前端隐藏） | `test_semantic_suites.py` 14 passed（含成功/失败/环境异常三条泄漏路径） |
| B 核验结果绑定版本/指纹 | 已修复（`sourceRevisionId` + 内容指纹 + 环境失败不覆盖） | `code-assessment.test.ts` 125 vitest 全绿（新增 5 条回归） |
| C 人工审阅真实闭环 | 已修复核心信任边界（服务端验证真实作品/派生证据/冻结快照/拒绝未满足 approved） | `test_reviews.py` 16 passed（真实 PG + RLS + 完整流程） |
| D SQL 比较器 | 已修复（类型区分/绝对容差/一对一匹配/非有限值/非法参数） | `test_sql_result_compare.py` 22 passed（含 4 个反例回归） |
| E 版本与进度口径 | 已修正（工具矩阵去 block 化、四维覆盖统计、文档纠偏） | `test_tool_lifecycle.py` 9 passed + `audit_coverage_dimensions.py` 输出 |

后端全量 **514 passed / 58 skipped / 0 failed**（含 PG 全套）；前端 typecheck 0、vitest **125 passed**、build 通过；契约重生成 `contracts:check` 一致；`reviews.spec.ts` e2e **4 passed**（chromium + mobile）。

---

## 1. A 隐藏测试泄漏

**原问题**：`semantic_suites.py` 的 `_assess_case` 把 independent 用例的 `stdin`、`expected_stdout`、`observed_stdout`、`case_code`（如 `indep-31`）写进 `cases`；硬编码判定理由拼接隐藏 stdin；这些进入公共响应 → 本地记录 → 同步 → 导出。

**修复**：
- `semantic_suites.py`：independent 用例在服务端即被去敏——`stdin/expected_stdout/observed_stdout` 置 `None`，`case_code` 改为不揭示输入的 `independent-<序号>`；`not_met` 理由改为“保密独立输入未通过…不公开”；`suspected_hardcoding` 理由只报失败数量、不再拼接隐藏 stdin。
- `responses.py`：`CodeSuiteCase.stdin/expected_stdout/observed_stdout` 改为 `str | None`（Optional），契约/TS 重生成。
- 前端 `CodeWorkspace.tsx`/`Evidence.tsx`：visible 用例渲染加 null 守卫，兼容旧记录。
- **旧记录兼容**：同步 `sync_schemas.py` 的 `CodeSuiteCase` 透传 Optional；旧记录（independent 带完整字段）仍可解析，前端只用聚合计数、从不渲染 independent 细节。

**测试**：`test_semantic_suites.py` 14 passed，新增 `test_hidden_inputs_never_leak_across_success_failure_and_env_error`（成功/硬编码失败/环境异常三条路径断言 independent 无 stdin/expected/observed/case_code 泄露、reason/fixed_reason 不含隐藏输入）。`test_semantic_suite_contract.py`(5) + `test_code_attempt_sync.py`(3) 仍绿。

---

## 2. B 核验结果与作品版本绑定

**原问题**：`CodeWorkspace.tsx` 的 `suiteLatest = suiteRows.find(...)` 取整活动最新套件结果，可把 A 版通过显示在 B 版旁；`currentSuiteAssessment` 取最新一条，环境失败会覆盖旧有效结论，新作品会继承旧通过状态。

**修复**：
- `domain/code.ts` + `sync_schemas.py`：`CodeAttempt.sourceRevisionId?` 记录套件运行所针对的固定任务修订（同步透传）。
- `domain/code-assessment.ts`：新增 `suiteRevisionKey`/`suiteAssessmentForRevision`；`currentSuiteAssessment` 改为按修订分组、最新修订决定、同修订内 met/not_met 不被后续 needs_review 抹去、新修订不继承旧修订通过。
- `CodeWorkspace.tsx`：`runSuiteCheck` 写入 `sourceRevisionId: selected.id`；套件结果按 `suiteAssessmentForRevision(suiteRows, selected)` 绑定当前版本，并标注内容指纹来源。

**测试**：`code-assessment.test.ts` 新增 5 条（版本切换不串用、同修订环境失败不覆盖、新修订环境失败不继承、恢复记录排除、legacy 指纹回退），vitest **125 passed / 19 files**。

---

## 3. C 人工审阅真实闭环

**原问题**：客户端自报作品 UUID/hash/server_tool 摘要，服务端未验证；补证随机 UUID+手填 hash；教师看不到完整作品；未满足必要条件仍可 approved；入口限于代码作品。

**修复**：
- `review.py`：`create_assignment` 按 `sync_object.code_attempt` 验证归属/修订/内容指纹/课程目标/活动版本/服务端核验结果存在（未同步 → 409 `WORK_NOT_SYNCED`，哈希/归属不符 → 422）；`server_tool` 证据由服务端从冻结结果派生（丢弃客户端摘要）；`resubmit` 逐个验证 `evidence_refs` 指向真实已同步新修订并追加冻结；`decide` 在任一 rubric 未 met 时拒绝 approved（422 `CANNOT_APPROVE_UNMET_CRITERIA`，学习达标与行政结案分离）。
- `models.py` + `migrations/0014`：`work_snapshot`（append-only JSONB 列表）冻结真实源文件+结果，经 RLS 仅本人/授权教师可见。
- 前端：`reviews.ts`/`Reviews.tsx` 补证改为选择真实新修订（自动取修订号+指纹，展示修改对照），去掉手填 hash+随机 UUID；`ReviewQueue.tsx` 展示冻结作品与核验。

**测试**：`test_reviews.py` 16 passed（真实 PG + RLS），覆盖完整流程「提交真实作品→接单→查看冻结证据→退回→真实新修订补证→再审签署→查看结果+异议」，以及负例（未同步 409、哈希不符 422、伪造 server_tool 被替换、未满足 approved 422、随机修订补证 409）。`reviews.spec.ts` e2e 4 passed（chromium + mobile，诚实标注无审阅者 + 未认证教师门禁）。

**明确剩余限制**：入口仍为已核验 code_attempt（fixed/semantic-suite）；证明/结构化推演/设计/解释等非代码作品的验证路径尚未接入（`_verified_code_work` 已结构化，扩展其他 attempt 类型即可），如实标注为后续工程。

---

## 4. D SQL 比较器

**原问题**：`True` 与 `1` 误判相等；`1.004` vs `1.006`（容差 0.01）误判不等；`1.01` vs `1.04`（容差 0.05）误判不等；高精度 Decimal 容差可能抛异常；容差多重集贪心可能漏判。

**修复**：重写 `sql_result_compare.py`——`normalize_cell` 输出带类型标签的规范单元（bool/number/str/other/nan/inf 互不混淆）；数值用绝对容差 `abs(a-b)<=tol`（不再做容差网格量化）；多重集/集合在容差下用带回溯的一对一完美匹配（非贪心）；NaN 永不等、Inf 按符号相等且忽略容差；负/NaN/Inf 容差抛 `ValueError`；int/float/Decimal 均为数值型比较。

**测试**：`test_sql_result_compare.py` 22 passed（含 4 个反例回归：bool≠number、绝对容差跨网格、高精度 Decimal、一对一匹配；另补 NULL/非有限值/非法参数/列匹配/重复行）。

---

## 5. E 版本和进度口径

**修复**：
- **工具能力口径**（`tool_lifecycle.py`）：`blocked_external` 改为仅限“真正缺资源/权限”；“未安装 containerlab/FRR、未建设隔离环境”重新归类为 `unavailable`（工程待办），network 八步改 `unsupported`，data 移除误导性 `external_blockers`。`test_tool_lifecycle.py` 9 passed（更新断言）。
- **覆盖统计口径**：新增只读 `tools/curriculum/audit_coverage_dimensions.py`，按当前发布版本统计四维并归档单列。实测：
  - `has_variants`（有变体字段）366/366；`executable`（可执行）366/366；`reliable_check`（判定可信=语义套件）**1/366**；`closed_loop`（完整闭环）**0/366**；归档版本 31 个单列、额外课程 1 个。
  - 明确“366 有变体字段 ≠ 366 完成独立迁移验收”。
- **文档纠偏**：`EXECUTOR_PROGRESS.md` 中“366 独立迁移通道/覆盖”改注为“有变体字段，非独立迁移验收”；引用四维口径。
- **CS01 不可变版本**：审计确认 `CS01-core-practice-0.9.0/manifest.json` 曾在 `ae6ce27` 原地追加 `semantic_suite` 发现块（未升版本）。该块为纯增量发现元数据，不改目标/理论/活动/变体/check_version，受信套件本身在服务端 `semantic_suites.py`（按 version_id 绑定）。列为已知不可变边界：今后对该版本的任何内容改动须升版本号，历史记录不受影响。

---

## 6. 测试命令与环境

后端（Windows PowerShell，worktree 根，PG 全套）：

```
$env:PYTHONPATH='services\backend\src'
$env:VAULT_DATABASE_URL='postgresql+psycopg://vault_dev:vault-dev-local-2026@127.0.0.1:5442/vault_dev'
$env:VAULT_TEST_DATABASE_URL='postgresql+psycopg://vault_dev:vault-dev-local-2026@127.0.0.1:5442/vault_ci'
$env:VAULT_TEST_API_DATABASE_URL='postgresql+psycopg://vault_api:ci-runtime-ephemeral-only@127.0.0.1:5442/vault_ci'
$env:VAULT_TEST_DATABASE_IS_DISPOSABLE='1'
services\backend\.venv\Scripts\python.exe -m pytest services/backend/tests -q -p no:cacheprovider --tb=short
# → 514 passed, 58 skipped, 0 failed
```

契约与前端：

```
python -m vault_backend.export_openapi --output packages/contracts/openapi.json
npm --prefix apps/web run contracts:generate && contracts:check   # 一致
npm --prefix apps/web run typecheck                                # 0 error
npm --prefix apps/web test                                         # 125 passed / 19 files
npm --prefix apps/web run build                                    # 通过
```

e2e（真实后端 8000 + 前端 5176 + WSL isolate worker 8091）：

```
$env:VAULT_E2E_PORT='5176'; $env:PLAYWRIGHT_CHANNEL='chrome'
$env:VAULT_E2E_MAIL_CAPTURE_DIR='<工作树>\.pytest-tmp-svc\mail'
npm --prefix apps/web run test:e2e -- reviews.spec.ts --workers=1   # 4 passed
```

---

## 7. 当前 HEAD / 远端 / 服务

- **HEAD `6ccb0cb`，已推送 `mine/hyx_dev`（`2a220c7..6ccb0cb`），未强推、未合 main。**
- 提交：`6ccb0cb fix(credibility): close review findings A-E on trust boundaries`（30 文件，+1469/−205）。
- 环境：Docker PG18 127.0.0.1:5442（vault_dev/vault_ci 均 head `0014_review_work_snapshot`）、后端 127.0.0.1:8000（ready、database ready、accounts/sync true）、前端 127.0.0.1:5176、WSL isolate worker 127.0.0.1:8091 box700（active）。
- **环境限制（如实记录，非代码回归）**：本会话中 Python 子进程无法经 WSL localhost 中继连接 8091（PowerShell 可连、Python httpx `ConnectError`），导致**依赖真实 worker 执行的 e2e（semantic-suite/synthetic-workshop/course-*）无法在本环境跑绿**；这一失败同样出现在**未被本轮改动的固定条件运行路径**上，证明与 A–E 修改无关。受影响逻辑已由后端 PG/单元测试覆盖（`test_semantic_suites.py` 14、`test_sql_result_compare.py` 22 等）；`reviews.spec.ts` e2e **4 passed**（不依赖 worker）。worker 直连 `/v1/runs` 实测返回 success，隔离箱本身健康。
- 注：本机 `%TEMP%` 对子进程不可写（Python `tempfile.gettempdir()` 回退到工作树，疑似 WSL root 曾污染 ACL），本轮后端以工作树 `.pytest-tmp-svc` 作为 TEMP/MAIL_CAPTURE（已 gitignore）。服务完成后保持运行。

---

## 8. 下一轮精确起点

1. C 非代码作品（证明/结构化推演/设计/解释）的审阅验证路径接入 `_verified_code_work`（structured_attempt/course_attempt/algebra_attempt），并扩展完整流程测试。
2. C 教师端补证修改对照的更强 diff（当前显示变化文件全文），及“学习达标 vs 行政结案”显式字段。
3. D 比较器接入 E03 有状态租约运行时的 check 阶段（B2 有状态租约运行时仍 unsupported，未集成不得宣称学生可用）。
4. E05 网络实验：安装 containerlab/FRR + 建设每租约独立 VM（工程待办，非外部阻断）。
5. 恢复 `%TEMP%` 子进程可写（ACL 修复）或固化工作树 TEMP 方案，使后端/测试无需临时改 TEMP。
