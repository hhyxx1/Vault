# 执行进度（EXECUTOR_PROGRESS）

> 接续 `document/handoff/13-course-delivery-2026-10-10/` 交接方案。本文件由执行体持续维护，供跨会话/交回 Codex 接续。只记录已验证事实，不写“全部完成”。

## 当前检查点

- 更新时间：2026-10-11
- worktree：`C:\Users\Remote\.codex\worktrees\485f\Vault`（detached HEAD）
- HEAD：`8db1533`，已推送且 `mine/hyx_dev = 8db1533`（https://github.com/hhyxx1/Vault.git）
- 本次新增提交：
  - `14b073a` chore(cs05): archive reproducible 2026-10-11 test run evidence
  - `8db1533` feat(health): split isolated execution configured, healthy and production-ready state

## 任务板状态（#23–#32）

- #23 completed — 迁移/Dexie/契约/CS05 包身份/测试库指向核对（head=0012_algebra_attempt，Dexie v10，CS05 0.2.0 三 finite_algebra 活动）。
- #24 completed — 服务栈启动并探活：PG 5442、WSL isolate worker 8091、后端 8000、前端 5176。
- #25 completed — CS05 收尾测试全部复现（证据见下）。
- #26 completed — health/ready 的 isolated_execution 不再写死 false，拆分为 configured / healthy / production_ready 三独立字段，并新增 worker 侧认证健康探针。
- #27 pending（下一项）— 复核 algebra_attempt 在学习证据总页、本地导出、课程卡、账号恢复/云同步的全站覆盖。
- #28 pending — 逐课审计 13 课 manifest/units，据实校准 TASK_BOARD.csv（不得预填完成）。
- #29–#32 pending — P1 公共工程 C01–C08；P2 CS05 其余原生模块+CS03+五类桥接；P3–P5 其余 10 课；P6–P7 教师/自建课/RAG/多模型/Skill 与全面验收、UI 对照、最终报告。

## 已完成项与真实证据

### 环境恢复（P0）
- 后端 venv 基础解释器曾整体丢失（`.venv\pyvenv.cfg` 指向的 `C:\Users\Remote\AppData\Local\vault-python-runtimes\cpython-3.13.16-windows-x86_64-none` 不存在）。用 uv 0.12.22（`C:\Users\Remote\AppData\Local\Temp\vault-uv-tools\bin\uv.exe`）以 `UV_PYTHON_INSTALL_DIR=...\vault-python-runtimes` 重装 CPython 3.13.16 到原路径，venv 复活且 site-packages 保留。
- Docker Desktop/WSL 启动后 PG 容器完成崩溃恢复；WSL `vault-code-worker.service` active，监听 127.0.0.1:8091。
- 共享 pytest 临时目录 `%TEMP%\pytest-of-Remote` 权限损坏（WinError 5，疑似 WSL root 侧运行污染），导致 82 个 setup error。**后续所有后端 pytest 必须带专属 `--basetemp=%TEMP%\vault-pytest-<名>`**。

### 测试基线（2026-10-11 复现，原始日志已归档到 `document/course-reviews/test-runs/`）
- 后端含 PG 全套：**427 passed / 58 skipped / 0 failed**（#26 前为 417/58，新增 10 个 health 测试）。58 skipped 为 Windows 主机上的 Linux/isolate 专用测试。
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

## 在改文件 / 工作区

- 工作区仅剩未跟踪 `services/backend/backend-run.txt`（旧本机日志，RUNBOOK 要求不提交、不删除）。无其它未提交改动。

## 运行中的服务与端口（完成后保持运行）

- PG：Docker 容器 `vault-development-postgres-1`，127.0.0.1:5442，dev 库 vault_dev（head 0012），测试库 vault_ci。
- WSL isolate worker：systemd `vault-code-worker.service`，127.0.0.1:8091（已加载新 /v1/health）；保活靠后台 `wsl -d Ubuntu -u root -- tail -f /dev/null`。
- 后端：127.0.0.1:8000（已加载新 health 逻辑，AUTH=true，连 PG，配 worker）。日志 `%TEMP%\vault-backend-out.txt` / `-err.txt`，mail capture `%TEMP%\vault-mail-capture`。
- 前端：127.0.0.1:5176（vite，日志 `%TEMP%\vault-web.txt`）。设计稿预览可用 5177。
- 关键 env 与启动方式见交接包 `RUNBOOK.md`；WSL worker token 必须用 `wsl base64 -w0 /etc/vault-code-worker.env` 在 PowerShell 解码，切勿内联 bash `$VAR`。

## 未解决问题 / 外部限制

- 58 个 Linux/isolate 测试在 Windows 跳过；需在 WSL 按 RUNBOOK 第 5 节补跑（CS05 120 份工件，作者测试与开发 worker 不可共用 box 700，宜 fixture 指定 701 或串行）。
- 合并 main 始终未授权（feature 分支不计 GitHub 贡献热力图）；需用户确认邮箱已验证后授权 push hyx_dev:main 或开 PR。
- 真实专业审校、真实多模型密钥、生产部署为外部不可得条件；Q4/Q5 与真实模型联调须如实保留，不得伪造签署或删目标降标准。

## 下一条具体任务

1. #27：系统排查 algebra_attempt 与 code_attempt/structured_attempt 在以下消费点是否对等覆盖，发现缺口即补齐并加测试：学习证据总页（Evidence）、本地导出/恢复、课程卡/进度、账号恢复与云同步（sync union / objectTypes / Dexie algebraAttempts / 服务端 sync_object 白名单与触发器）。
2. #27 完成后提交推送，再进入 #28 逐课审计与 TASK_BOARD.csv 校准。
