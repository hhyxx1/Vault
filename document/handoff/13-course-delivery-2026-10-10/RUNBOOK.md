# 接手运行、测试与 Git 手册

日期：2026-10-10。命令从 worktree 根目录执行；启动前先看已有进程，避免抢占或关闭用户预览。

## 1. 只读确认起点

```powershell
Set-Location 'C:\Users\Remote\.codex\worktrees\485f\Vault'
git status --short --branch
git log -5 --oneline
git worktree list
git remote -v
Get-NetTCPConnection -State Listen | Where-Object LocalPort -In 5176,5177,5178,8000,8091,5442 | Select-Object LocalAddress,LocalPort,OwningProcess
Get-Content services/backend/.venv/pyvenv.cfg
& services/backend/.venv/Scripts/python.exe -c 'import sys,ctypes,ssl,psycopg; print(sys.version); print(sys.base_prefix)'
node --version
npm --version
docker version
wsl -d Ubuntu -u root -- systemctl is-active vault-code-worker.service
```

快照时：前端 5176、API 8000、WSL worker 8091、Docker PG18 5442。端口和 PID 会变化，以当前输出为准；PID 不写死。业务预览已占 5176，旧原型 README 里“用5176启动设计稿”的命令不能直接照抄。

Python `.venv` 目前使用 `C:\Users\Remote\AppData\Local\vault-python-runtimes\cpython-3.13.16-windows-x86_64-none`。此前 TEMP 内解释器丢失标准库导致意外加载 Anaconda，已改用上述稳定路径；旧 pyvenv.cfg 留在 ignored 备份。安装时 uv 的 minor-link 注册曾报错，但实际解释器、ctypes、ssl、psycopg 导入已验证。不要因同名目录存在就认定运行时完整，也不要改全局 Anaconda 或其他项目环境。

Docker 曾出现 dockerInference 文件访问错误，修复背景见 `document/DOCKER_RECOVERY_2026-10-10.md`。不要随意 factory reset、prune 卷、删除 VHD 或全局清理 TEMP。

## 2. 服务保持运行

### 前端与设计稿

前端运行中无需重复启动；否则在专用终端运行：

```powershell
npm --prefix apps/web run dev -- --port 5176 --strictPort
```

设计稿需要单独对照时，在确认 5177 空闲后另一个终端运行：

```powershell
& services/backend/.venv/Scripts/python.exe document/prototypes/knowledge-atlas/serve.py --port 5177
```

设计稿地址 `http://127.0.0.1:5177/prototypes/knowledge-atlas/index.html`；真实页 `http://127.0.0.1:5176/atlas?course=CS03&edition=core`。如用户指定其他端口，先核对占用并同步浏览器测试配置，不偷偷迁移用户服务。

### API、数据库与 worker

API 用 `.venv/Scripts/python.exe -m vault_backend`，不要绕过入口改变 Windows asyncio 配置。需要的环境变量从现有私有开发配置读取，密钥不打印：

- `VAULT_DATABASE_URL`：开发运行角色 URL；迁移用独立授权角色。
- `VAULT_AUTH_ENABLED=true`、`VAULT_MAIL_CAPTURE_DIR`：仅开发私有 TEMP 子目录；捕获不等于真实发邮件。
- `VAULT_ALLOWED_ORIGINS`：JSON 数组，明确包含实际前端回环地址，禁止 `*`。
- `VAULT_CODE_WORKER_URL=http://127.0.0.1:8091`、`VAULT_CODE_WORKER_TOKEN`：后者可由已有 `/etc/vault-code-worker.env` 在内存读取并传递，不显示文件全文。

仅在修改配置/后端代码确需重启时，查监听 PID 与 CommandLine，确认是该 worktree 的 API 后温和结束并重启，日志存私有 TEMP。后台启动用隐藏窗口。不要结束所有 python/node/docker 进程。

WSL systemd 服务在发行版退出后可能停止；执行 `systemctl is-active` 会唤醒但未必持续保活。开发时可在专用后台会话运行以下保活，并记录该会话用途：

```powershell
wsl -d Ubuntu -u root -- tail -f /dev/null
```

用户要求预览服务保持运行。worker 需要重启时只重启 `vault-code-worker.service`，先确认没有进行中的实验。API health 的固定 feature flag 不是实际执行检查；检查真实租约运行及 worker 返回，同时修复该健康状态欠账。

### 迁移

当前代码要求 head `0012_algebra_attempt`。数据库 dev/test 均曾升级，但接手时分别检查，不假定所有实例都一致。

```powershell
& services/backend/.venv/Scripts/python.exe -m alembic -c services/backend/alembic.ini current
& services/backend/.venv/Scripts/python.exe -m alembic -c services/backend/alembic.ini heads
# VAULT_DATABASE_URL 确认指向目标开发库、且已备份后才执行升级
& services/backend/.venv/Scripts/python.exe -m alembic -c services/backend/alembic.ini upgrade head
```

运行账号应遵循既定非超级用户/NOBYPASSRLS 权限；核对当前开发环境，不将本机便捷配置复制为生产配置。迁移降级和销毁仅在专用测试库。

## 3. 常规验证

接口 schema 更改后先导出，再生成 TypeScript，不手工修改生成文件：

```powershell
& services/backend/.venv/Scripts/python.exe -m vault_backend.export_openapi --output packages/contracts/openapi.json
npm --prefix apps/web run contracts:generate
npm --prefix apps/web run contracts:check
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run build
```

后端本机测试：

```powershell
$env:VAULT_AUTH_ENABLED='false'
& services/backend/.venv/Scripts/python.exe -m pytest services/backend/tests -q -p no:cacheprovider --tb=short
```

PG 测试需提前配置 `VAULT_TEST_DATABASE_URL`（测试迁移角色）、`VAULT_TEST_API_DATABASE_URL`（同库受限运行角色）和 `VAULT_TEST_DATABASE_IS_DISPOSABLE=1`。仅使用专用可销毁库，例如已有 `vault_ci`；**不得将 `vault_dev` 或任何真实学习数据实例标记为可销毁**。未配置时跳过，不算通过；确认后运行全套并保存实际输出：

```powershell
if (-not $env:VAULT_TEST_DATABASE_URL -or -not $env:VAULT_TEST_API_DATABASE_URL) { throw '需要专用测试库配置' }
# 本机专用测试库固定允许 vault_ci；先执行校验，不输出 URL 或密码。
@'
import os
from urllib.parse import urlsplit
owner = urlsplit(os.environ['VAULT_TEST_DATABASE_URL'])
runtime = urlsplit(os.environ['VAULT_TEST_API_DATABASE_URL'])
assert owner.scheme == runtime.scheme == 'postgresql+psycopg'
assert (owner.hostname, owner.port, owner.path) == (runtime.hostname, runtime.port, runtime.path)
assert owner.hostname in {'127.0.0.1', 'localhost'} and owner.port == 5442
assert owner.path == '/vault_ci', 'Refusing a non-disposable database'
assert owner.username == 'vault_dev' and runtime.username == 'vault_api'
assert not owner.query and not runtime.query, 'Unexpected connection override'
print('Verified local vault_ci test target and separate role names')
'@ | & services/backend/.venv/Scripts/python.exe -
if ($LASTEXITCODE -ne 0) { throw '测试库校验失败，禁止设置可销毁标记或执行测试' }
$env:VAULT_TEST_DATABASE_IS_DISPOSABLE='1'
$runStamp=Get-Date -Format 'yyyyMMdd-HHmmss'
& services/backend/.venv/Scripts/python.exe -m pytest services/backend/tests -q -p no:cacheprovider --basetemp="$env:TEMP/vault-tests-$runStamp" --tb=short
```

上述角色名/端口是当前本机约定，不用于CI；CI使用自己的临时数据库配置。另建测试环境时先确认新实例确实专用且可销毁，核查数据库角色权限，再明确修改白名单；不能删掉断言来让命令通过。该校验不会代替权限测试或证明数据库内没有用户资料。

Ruff 按修改文件运行，提交前还需与CI一致在 `services/backend` 全目录检查。`generic_rules.py` 是 pprint 生成的冻结字典；已在 pyproject 中仅为该文件忽略 E501 长行规则，避免重排历史条目。其他 lint、语义和不可变性检查均保留，检查器和手写代码不能借此跳过。已有冻结规则条目不得修改。

```powershell
& services/backend/.venv/Scripts/python.exe -m ruff check services/backend/src/vault_backend/course_checks/algebra_submission.py services/backend/src/vault_backend/course_checks/finite_algebra.py services/backend/migrations/versions/0012_algebra_attempt.py
```

## 4. 浏览器闭环

先确认前端及 API 真实运行，浏览器测试独立上下文不会使用用户正在看的学习空间。

```powershell
$env:VAULT_E2E_PORT='5176'
$env:PLAYWRIGHT_CHANNEL='chrome'
npm --prefix apps/web run test:e2e -- course-algebra.spec.ts --workers=1
```

全目标作者走查（显式开启，较慢）：

```powershell
$env:VAULT_ALL_OBJECTIVES_E2E='1'
npm --prefix apps/web run test:e2e -- course-all-objectives.spec.ts --project=chromium --workers=1
Remove-Item Env:VAULT_ALL_OBJECTIVES_E2E
```

只验证变更课程可在命令末尾加 `-g CS05`。当前 walker 已过滤 code，并用 `?task=code`，图谱分母取 objectives 数量；新增原生活动需单独测试，不应让代码 walker 把活动数当目标数。该测试会主动查看参考答案，不能作为独立迁移证据。

图谱视觉/交互复用 `apps/web/e2e/design-reference.spec.ts`、`atlas-design.spec.ts`、`atlas-motion.spec.ts`，先读它们的端口/截图前置条件。做同视口对照，至少全景/局部/目标/证据和窄屏；按前端标准补键盘、触摸、减少动效、200%缩放。不要更改快照或断言来掩盖实际倒退。

## 5. Linux 真实执行

Windows pytest 跳过 Isolate 不表示课程工件已执行。当前 WSL Ubuntu 有 `/opt/vault-worker-dev/bin/python`、原生 isolate 和已安装工具链。先确认目录和工具链仍存在，再运行所改课程测试。示例（CS05新版本120份工件）：

```powershell
wsl -d Ubuntu -u root -- bash -lc 'cd /mnt/c/Users/Remote/.codex/worktrees/485f/Vault && PYTHONPATH=services/backend/src VAULT_ISOLATE_INTEGRATION=1 /opt/vault-worker-dev/bin/python -m pytest services/backend/tests/test_cs05_code.py --noconftest -o asyncio_mode=auto -p no:cacheprovider -q --tb=short -k algebra'
```

这里 `--noconftest` 适用于该直接调用 IsolateWorker 的作者工件测试；别给依赖 HTTP/数据库 fixture 的测试照搬。许多测试 `IsolateWorker()` 默认 box 700，开发 worker 也可能使用该 box；不可同时运行。持续建设时给作者测试通过 fixture 明确分配保留 box（例如701），或串行运行，不能让并发测试互相清理容器。不要把 box 选择开放给学生请求。

当前代码固定核验注册工具：`tools/curriculum/register_code_book.py <fixture-relative-path>`。新增版本后跑注册不可变性测试；不要直接改旧规则。CS05包构建工具 `tools/curriculum/build_cs05_algebra.py` 会写包和fixture，生成后复查diff，不对已经发布版本随意重复改写。

## 6. 台账与文件检查

```powershell
& services/backend/.venv/Scripts/python.exe tools/curriculum/build_coverage_ledger.py
& services/backend/.venv/Scripts/python.exe -m pytest services/backend/tests/test_coverage_ledger.py -q -p no:cacheprovider
git diff --check
git status --short
```

现有覆盖生成器输出的是工程映射，不会自动证明内容完整。新增活动类型必须扩展映射且保留证据限制；不能把 normal_case_ids 不为空当 Q1–Q5。

日志存 `document/course-reviews/test-runs/`，截图可放 `document/assets/` 或本次既有课程截图目录。写清测试命令、课程/环境版本、通过/失败/跳过及原因。最新存档：`CS05_BACKEND_2026-10-10.txt` 为417/58；`CS05_NATIVE_2026-10-10.txt`为6通过。30目标走查与120Linux工件结果在开发工具输出中已确认，但未留独立原始日志文件，不得补造“原始日志”；需要归档时按当前版本重跑。

## 7. Git 与接续

不要切换被另一worktree占用的hyx_dev，不要reset --hard、clean -fd、强推或擅自合并main。detached HEAD可以正常commit并推到指定分支。

```powershell
git fetch mine
git rev-list --left-right --count HEAD...mine/hyx_dev
git diff --stat
# 按已检查的文件明确 git add；不要把密钥、数据库、临时日志混入。
git commit -m "Complete <course/module or capability> with verified learning loop"
git push mine HEAD:hyx_dev
```

若远端有新提交，先检查是否别人已继续开发；保留本地成果后再按真实提交关系整合，不能强推覆盖。没有提交时引用真实现有HEAD；不要编造提交号。`services/backend/backend-run.txt` 是未纳入本任务的本机日志，不提交、不删除；其他未知未跟踪文件同样先检查归属。

所有服务完成测试后继续运行。每一里程碑更新 `document/handoff/EXECUTOR_PROGRESS.md`，供下一次接续或Codex复核。
