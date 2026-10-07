# 新版开发与本机运行

版本：v0.3。2026 年 10 月 7 日。适用于 `hyx_dev` 的学习、账号同步与个人课程开发切片。

## 本次能运行的内容

- 13 门课程的建设目录；只有数据结构的栈单元工程样例开放，两项目标不代表全课程。
- 图谱及等价列表、学习目标确认、理论与操作往返、七步栈推演、Python 作品编辑。
- IndexedDB 保存草稿、不可变作品版本、求助记录和绑定版本的核验记录；刷新恢复与 JSON 导出。
- FastAPI 临时访客租约和确定性栈核验。真实执行固定操作、逐项比较；解释和迁移应用保持待复核。
- 教师私人备课草稿：访客先在本机保存，教师账号可同步自己的草稿；学生账号不上传教师草稿。尚不能发布课程或访问学生数据。
- 学生可从默认目录之外只输入课程名称建立私人草稿，逐步添加目标和学习点，保存“原理—操作—结果—理解—再尝试”的自述记录；访客本地保存，登录后可按逐项状态同步。此路径尚无经审校整课、个人课程 Agent 辅导或自动实践核验。
- PostgreSQL 初始迁移与约束、生成 OpenAPI／TypeScript、锁定依赖和 CI 配置。

配置独立数据库与私有开发邮件捕获器后，可以注册学生／教师账号、确认邮箱、登录并承接本机记录、逐项同步及跨设备恢复。教师仍待核实，不能发布或读取学生数据。CS03 有局部 Agent 工程样例，个人课程 Agent、Skill 生命周期、资料处理与 RAG、多语言隔离执行、完整课程发布尚未开放。代码编辑器只保存作品，不能把它当成已经接入编译器。默认 13 门完整课程当前为 0／13，完整第一阶段仍须交付全部课程及 PRD 的全部 P0 要求。

## 运行前提

Node 24.19.0、npm；Python 3.13.16、uv 0.12.22。前端使用 TypeScript 6；OpenAPI 生成工具的 TypeScript 5 单独锁定在 `packages/contracts/tooling/`，详见验证记录。全部命令从仓库根目录执行，两个开发进程在两个终端启动。

访客核验只需 API 和前端，数据库不是该链路的持久存储。API 运行单进程；租约保存在内存，重启后重新建立租约，本地作品保留。不接入真实学生个人数据进行当前工程验证。

### API

```powershell
Set-Location services/backend
uv sync --frozen --python 3.13.16
uv run --frozen python -m vault_backend
```

API：`http://127.0.0.1:8000`，接口文档：`/api/v1/docs`。默认只绑定回环地址。使用该模块入口启动；它在Windows显式选择psycopg所需Selector loop，不以旧全局policy假定Uvicorn会沿用。

`GET /api/v1/health/live` 用于进程存活检查；`health/ready` 检查 PG 和 feature flags，没有配置 PG 时返回 503／partial，仍可使用访客栈核验。账号与同步默认关闭，配置后显式启用；Agent、隔离执行与 RAG 仍关闭。

### Web

```powershell
Set-Location apps/web
npm ci
npm run dev -- --port 5173 --strictPort
```

打开 `http://127.0.0.1:5173`，Vite 将 `/api` 代理到回环 API。默认允许的浏览器 Origin 含 localhost／127.0.0.1:5173；自定义端口需设置 `VAULT_ALLOWED_ORIGINS` 为明确的 JSON 数组，再重启 API。不使用通配 Origin。

## 可选的开发数据库

本机已有 PostgreSQL 时使用独立测试数据库和角色。迁移角色与运行角色分开：运行角色必须是 `NOSUPERUSER NOBYPASSRLS`，只给予所需的 schema／表权限，不用迁移管理员运行 API。RLS 在事务中读取受信业务层设置的 `vault.account_id`；启用开发认证后由真实会话设置，不能由请求正文自授账号身份。

也可使用 `infra/compose.dev.yml` 的 PG18／pgvector 固定镜像。在启用 Docker Engine 的本机生成随机密码后启动：

```powershell
$env:VAULT_POSTGRES_PASSWORD = '<填写独立随机密码>'
docker compose -f infra/compose.dev.yml up -d postgres
```

只暴露 `127.0.0.1:5442`，PG18 数据目录使用 `/var/lib/postgresql` 持久卷。密码不放入 Git 或命令输出；该开发配置不等于生产部署。当前迁移不创建向量索引，不能据镜像可用推导 RAG 已实现。

在 `services/backend` 的终端设置迁移 URL 后：

```powershell
$env:VAULT_DATABASE_URL = 'postgresql+psycopg://<迁移用户>:<密码>@127.0.0.1:<端口>/<独立开发库>'
uv run --frozen alembic upgrade head
uv run --frozen alembic check
```

API 使用另一终端内的运行角色 URL。`VAULT_TEST_DATABASE_URL` 是可销毁测试库迁移 URL，`VAULT_TEST_API_DATABASE_URL` 为同库受限角色 URL。PG 测试还要求显式设置 `VAULT_TEST_DATABASE_IS_DISPOSABLE=1`：并发事务用例会提交合成测试行。只在独立可销毁库运行，测试后重建；迁移 round trip 同样只在该库执行。

## 开发账号与邮箱确认

账号使用独立 PostgreSQL 数据库；先按上一节执行迁移，当前 head 为 `0005_personal_course_sync`，并为受限运行角色授予新表权限。迁移角色与 API 角色仍分开，不使用超级用户运行 API。个人试用数据库与可销毁测试数据库必须分开，迁移降级测试不能指向已开始使用的账号数据库。

在 API 终端配置运行角色 URL，并添加：

```powershell
$env:VAULT_AUTH_ENABLED = '1'
$env:VAULT_MAIL_CAPTURE_DIR = Join-Path $env:TEMP 'vault-private-development-mail'
uv run --frozen python -m vault_backend
```

打开 `/account` 注册学生或教师账号。当前没有向真实邮箱投递邮件；确认／重置消息仅保存在上述私有 TEMP 目录。使用相同配置的另一个本机终端读取本人选定的捕获消息：

```powershell
uv run --frozen python -m vault_backend.auth --email '<本人注册邮箱>' --purpose verify_email
```

该命令仅供开发者在本机读取选定消息，不挂载为 HTTP 收件箱，也不把输出复制到 Git 或公开日志。在账号页的邮箱确认入口输入消息中的一次性 token；密码重置使用 `--purpose reset_password`。消息为开发捕获，不将“捕获成功”说成真实邮件送达。生产环境禁止启用当前捕获器认证；真实邮件适配及生产验收仍待实施。

登录后，本地空间页分别显示归属、待传、已同步与冲突。保留本地原件；同一账号可以恢复自己的云端空间，其他账号不会获得原账号的待关联或已关联记录。同步导入的核验历史只负责保存，另设备显示待复核，不能因此直接增加掌握进度。具体流程与边界见 [账号同步实现](ACCOUNT_SYNC_IMPLEMENTATION.md)。

## 检查与契约生成

前端：`npm run typecheck`、`npm test`、`npm run build`。后端：`uv run --frozen ruff check .`、`uv run --frozen pytest -q`。不提供 PG 环境变量时 PG 测试会跳过，不能把跳过写成数据库通过。

先在 `packages/contracts/tooling/` 执行 `npm ci`。修改 API 后从 `services/backend` 导出：

```powershell
uv run --frozen python -m vault_backend.export_openapi --output ../../packages/contracts/openapi.json
```

再从 `apps/web` 执行 `npm run contracts:generate`，审阅两个生成文件。`contracts:check` 与后端导出的 `--check` 模式拒绝生成文件漂移。

浏览器检查需要运行 API，前端由 Playwright 自动启动（或复用相同端口的开发服务）：

```powershell
Set-Location apps/web
npx playwright install chromium
$env:VAULT_E2E_MAIL_CAPTURE_DIR = Join-Path $env:TEMP 'vault-private-development-mail'
npm run test:e2e
```

本机已安装 Chrome 时，可设置 `$env:PLAYWRIGHT_CHANNEL='chrome'` 使用现有 Chrome；CI 使用 Playwright Chromium。完整浏览器回归使用已迁移的独立测试数据库、启用的开发账号 API 和相同邮件捕获目录，不能用个人试用数据库；访客回归不证明账号回归通过。CI 只运行合成作品和临时测试数据库，没有部署步骤，不上传邮箱捕获文件。

生产应用壳离线测试使用生产构建，不能用 Vite 开发服务器替代。从 `apps/web` 执行 `npm run build`，另一个终端执行 `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort`，再执行 `npm run test:offline`；测试会让浏览器真正断网、重开工作台并检查缓存边界。现有 5173 开发服务可继续运行。公开静态壳缓存不含 API 数据，模型／核验和未缓存的私有资料仍需网络。

## 数据与诊断

开源部署可在 API 环境中设置 `VAULT_MODEL_PROFILES`（JSON 数组）及 `VAULT_MODEL_TASK_DEFAULTS`（职责到 profile id 的 JSON 对象），再设置 `VAULT_AGENT_ENABLED=true`。示例和安全边界见 [模型路由设计](MODEL_ROUTING_DESIGN.md)。当前只接受部署者可信配置的端点；个人用户连接／个人密钥界面尚未交付。没有真实模型时保持 Agent 关闭，学习与确定性核验仍可运行。

设备草稿保存在当前浏览器的 IndexedDB。不同浏览器／Origin 有独立数据；清理网站数据会清除学习记录，操作前用“本地空间”导出。导出的作品可能含私人内容。已登录且逐项确认的记录可以从账号恢复；尚未同步、被拒绝、冲突和附件等记录仍需保留本地原件。当前没有经过生产备份／灾难恢复验收。

核验成功后先在本地事务提交记录，再向短期服务确认清理。API 不保存访客作品到 PG、队列或检查点。默认租约闲置 30 分钟、最长 2 小时；浏览器收到失效响应可从本地版本重建。取消／确认会清理正文，服务器重启清空临时状态。

不得提交 `.env`、访问凭据、数据库、`node_modules`、`.venv`、运行日志、浏览器测试缓存或真实学习数据。前端故障先检查 `/api` 代理与 API 存活；数据库 ready 失败和访客核验可用是两个独立事实。

工程和验收现状见 [开发状态](IMPLEMENTATION_STATUS.md)、[技术验证](TECHNICAL_VALIDATION.md) 与 [前端品质复核](FRONTEND_QUALITY_REVIEW.md)。
