# 本轮修复执行清单（EXECUTOR_FIX_PLAN）

> 基线：`2a220c7`（已推送 `mine/hyx_dev`）。本轮只修复复核发现 A–E 的可信度问题，不宣布 13 门课交付。

## 任务 → 落点 → 完成判据

### A. 隐藏测试泄漏
- 文件：`services/backend/src/vault_backend/course_checks/semantic_suites.py`、`responses.py`、`guests.py`、`sync_schemas.py`；前端 `CodeWorkspace.tsx`、`Evidence.tsx`。
- 问题：independent 用例的 stdin/expected_stdout/observed_stdout/case_code 与硬编码失败理由里的隐藏输入进入公共响应，进而落入本地记录/同步/导出。
- 修复：服务端在 `_assess_case`/`run_suite` 对 independent 用例只返回 `kind/status/reason`（reason 去隐藏输入与期望答案），stdin/expected/observed/case_code 一律置 None（case_code 改为 `independent-<序号>`）；硬编码 fixed_reason 不再拼接隐藏 stdin。`CodeSuiteCase` 三字段改 Optional。前端对 visible 渲染加 null 守卫（兼容旧记录）。同步/导出透传 Optional，向后兼容旧记录。
- 完成判据：新增泄漏回归测试（成功/失败/环境异常三条路径断言独立用例无 stdin/expected/observed/case_code，reason/fixed_reason 不含隐藏值），后端 500+ 全绿，契约重生成一致，前端 typecheck/vitest 全绿。

### B. 核验结果与作品版本绑定
- 文件：`apps/web/src/ui/CodeWorkspace.tsx`、`apps/web/src/domain/code-assessment.ts`、`code.ts`、`local/database.ts`。
- 问题：`suiteLatest` 取整活动最新套件，未绑定当前选中修订；环境失败可覆盖旧有效结论；新作品继承旧通过状态。
- 修复：套件 attempt 记录来源修订（`sourceRevisionId`）并保留 requestHash 指纹；显示/聚合仅认 `sourceRevisionId === selected.id && requestHash === selected.requestHash`；`currentSuiteAssessment`/`bestCodeObjectiveState` 改为“同修订下有效结论不被后续环境失败覆盖，跨修订不继承”。历史结果标注来源修订。
- 完成判据：新增版本切换/修改后重跑/环境失败/账号恢复回归测试（vitest），typecheck/vitest 全绿。

### C. 人工审阅真实闭环
- 文件：`review.py`、`review_schemas.py`、`models.py`、`migrations/0014_*`、`sync.py`(只读查询)；前端 `reviews.ts`、`Reviews.tsx`、`ReviewQueue.tsx`；测试 `test_reviews.py`。
- 问题：服务端未验证真实作品与核验来源；补证随机 UUID + 手填 hash；教师看不到完整作品；必要条件未满足仍可 approved；入口限于代码作品。
- 修复：`create_assignment` 按 `sync_object.code_attempt` 验证归属/修订/内容指纹/服务端核验结果存在；`server_tool` 证据由服务端从冻结结果派生（不信任客户端摘要）；新增 `work_snapshot` 冻结源文件+结果供教师查看；`resubmit` 验证 evidence_refs 指向真实已同步新修订并冻结；`decide` 在任一 rubric 未 met 时拒绝 approved；`work_snapshot` 经 RLS 仅本人/授权教师可见。
- 完成判据：新增完整流程 PG 测试（提交真实作品→接单→查看冻结证据→退回→修改补证→再审签署→查看结果+异议）+ 负例（未同步 409/哈希不符 422/伪造证据替换/未满足 approved 422），后端全绿。

### D. SQL 比较器
- 文件：`services/backend/src/vault_backend/course_checks/sql_result_compare.py`、`tests/test_sql_result_compare.py`。
- 问题：True 与 1 误判相等；1.004 vs 1.006 在容差 0.01 误判不等；1.01 vs 1.04 在容差 0.05 误判不等；高精度 Decimal 在容差模式可能异常；multiset 贪心可能漏判。
- 修复：normalize 区分 bool/number（True≠1）；数值容差改为区间量化（确定性的相对/绝对容忍、正确处理 1.004/1.006 与 1.01/1.04）；Decimal 全走 Decimal 路径避免 float 精度/异常；multiset/set 保持 dict 精确多集（已一对一），补非有限值/非法参数/NULL/列/重复行回归。
- 完成判据：`test_sql_result_compare.py` 全绿（含 4 个反例回归）。

### E. 版本和进度口径
- 文件：`tools/curriculum/*`（统计脚本）、`document/handoff/EXECUTOR_FINAL_REPORT.md`、`EXECUTOR_PROGRESS.md` 相关条目。
- 问题：CS01 0.9.0 在原版本号下被修改；统计默认用当前发布版本/归档单列；分别统计变体/可执行/判定可信/完整闭环；工具能力区分已实现与当前可用；交接文档过度宣称“完整闭环”。
- 修复：审计 CS01 不可变版本（若 0.9.0 内容被改，新增版本或还原并保护历史）；统计口径脚本分开“当前发布/归档”，按四维度统计（有变体/可执行/判定可信/完整闭环）；修正文档过度宣称。

## 验证命令（据 RUNBOOK）
- 后端（非 PG 单元）：`.venv\Scripts\python.exe -m pytest ... -q`
- 后端 PG 全套：需 `VAULT_TEST_DATABASE_URL/API/IS_DISPOSABLE`（vault_ci）
- 契约：`export_openapi` + `contracts:generate` + `contracts:check`
- 前端：`typecheck`、`vitest`、e2e（Playwright）

## 当前环境
- 服务均未运行：Docker Desktop 未启动、WSL 不可达、无监听端口（5176/8000/8091/5442）。需先恢复 Docker/PG/WSL/后端/前端，再跑 PG 与 e2e。
