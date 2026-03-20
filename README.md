# 智能教学平台

基于 FastAPI + React + PostgreSQL 的智能教学管理系统，支持学生与教师双端业务，包括问答、问卷、能力测试、课程资料与知识库等功能。

## 文档同步状态

- 同步时间：2026-03-20
- 线上核验主机：`8.159.151.36:4598`
- 已同步目录：`/opt/ai4teaching/backend`、`/opt/ai4teaching/frontend`、`/opt/ai4teaching/deploy`
- 已同步文件：`/opt/ai4teaching/完整空数据库.sql`
- 说明：服务器不依赖 README 运行。文档已在完成代码同步后按本地最新代码与部署配置重写。

## 仓库结构

```text
Vault/
├── backend/                # FastAPI 后端
├── frontend/               # React + Vite 前端
├── deploy/                 # Docker 与 Nginx 生产配置
├── database/               # SQL 脚本（初始化与迁移）
└── README.md               # 当前总览文档
```

## 技术栈

- 后端：FastAPI、SQLAlchemy、PostgreSQL、JWT、ChromaDB/pgvector（可选）
- 前端：React 18、TypeScript、Vite、React Router、Axios、Tailwind CSS
- 部署：Docker Compose + Nginx（HTTPS 反代）

## 本地开发快速开始

1. 环境准备：Python 3.12+、Node.js 18+、PostgreSQL 14+
2. 初始化数据库：创建 `app_project`，执行 `backend/database/full_export.sql`（或 `init.sql`）
3. 启动后端：在 `backend/` 执行 `pip install -r requirements.txt` 后运行 `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
4. 启动前端：在 `frontend/` 执行 `npm install && npm run dev`

开发访问地址：
- 前端：`http://localhost:3000`
- 后端文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`

## 生产部署现状（按 deploy 配置）

- Docker 暴露端口：后端 `18000 -> 8000`，前端 `18080 -> 80`
- 域名反代：`https://ai4teaching.cn`
- 反代规则：`/api/*` 转发到后端，其他路径转发到前端
- 关键配置文件：
  - `deploy/docker-compose.prod.yml`
  - `deploy/nginx-ai4teaching.conf`

## 子文档入口

- 后端说明：`backend/README.md`
- 前端说明：`frontend/README.md`

## 备注

涉及凭据（数据库密码、密钥、服务器密码）请统一通过环境变量或私有配置管理，不要写入版本库。
