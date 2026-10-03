# 新版开发与本机运行

版本：v0.1。2026 年 10 月 3 日。适用于 `hyx_dev` 的首个工程切片。

## 本次能运行的内容

- 13 门课程的建设目录；只有数据结构的栈单元工程样例开放，两项目标不代表全课程。
- 图谱及等价列表、学习目标确认、理论与操作往返、七步栈推演、Python 作品编辑。
- IndexedDB 保存草稿、不可变作品版本、求助记录和绑定版本的核验记录；刷新恢复与 JSON 导出。
- FastAPI 临时访客租约和确定性栈核验。真实执行固定操作、逐项比较；解释和迁移应用保持待复核。
- 教师设备备课草稿：默认私人保存。它不授予教师身份，尚不能上传、发布或访问学生数据。
- PostgreSQL 初始迁移与约束、生成 OpenAPI／TypeScript、锁定依赖和 CI 配置。

登录、账号关联和云同步、Agent／Skill、资料处理与 RAG、多语言隔离执行、完整课程发布尚未开放。代码编辑器只保存作品，不能把它当成已经接入编译器。完整第一阶段仍须交付 13 门课程及 PRD 的全部 P0 要求。

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

`GET /api/v1/health/live` 用于进程存活检查；`health/ready` 检查 PG 和 feature flags，没有配置 PG 时返回 503／partial，仍可使用访客栈核验。账号等未实现能力始终显示关闭。

### Web

```powershell
Set-Location apps/web
npm ci
npm run dev -- --port 5173 --strictPort
```

打开 `http://127.0.0.1:5173`，Vite 将 `/api` 代理到回环 API。默认允许的浏览器 Origin 含 localhost／127.0.0.1:5173；自定义端口需设置 `VAULT_ALLOWED_ORIGINS` 为明确的 JSON 数组，再重启 API。不使用通配 Origin。

## 可选的开发数据库

本机已有 PostgreSQL 时使用独立测试数据库和角色。迁移角色与运行角色分开：运行角色必须是 `NOSUPERUSER NOBYPASSRLS`，只给予所需的 schema／表权限，不用迁移管理员运行 API。RLS 在事务中读取受信业务层设置的 `vault.account_id`；当前未开放任何账号写入接口。

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
npm run test:e2e
```

本机已安装 Chrome 时，可设置 `$env:PLAYWRIGHT_CHANNEL='chrome'` 使用现有 Chrome；CI 使用 Playwright Chromium。CI 只运行合成作品和临时测试数据库，没有部署步骤。

## 数据与诊断

设备草稿保存在当前浏览器的 IndexedDB。不同浏览器／Origin 有独立数据；清理网站数据会清除学习记录，操作前用“本地空间”导出。导出的作品可能含私人内容，当前没有云端备份。

核验成功后先在本地事务提交记录，再向短期服务确认清理。API 不保存访客作品到 PG、队列或检查点。默认租约闲置 30 分钟、最长 2 小时；浏览器收到失效响应可从本地版本重建。取消／确认会清理正文，服务器重启清空临时状态。

不得提交 `.env`、访问凭据、数据库、`node_modules`、`.venv`、运行日志、浏览器测试缓存或真实学习数据。前端故障先检查 `/api` 代理与 API 存活；数据库 ready 失败和访客核验可用是两个独立事实。

工程和验收现状见 [开发状态](IMPLEMENTATION_STATUS.md)、[技术验证](TECHNICAL_VALIDATION.md) 与 [前端品质复核](FRONTEND_QUALITY_REVIEW.md)。
