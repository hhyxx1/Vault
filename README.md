# Vault

Vault 是一个面向 CS 教学场景的智能体系统：

- 以“学生画像 + 课程资料 + 关系联动”为核心，支持教学问答、知识追踪与个性化评测。
- 以 Skills（Markdown 工作流）驱动能力编排，让能力可增量扩展。

本仓库当前实现形态：FastAPI 后端 + React 前端 + PostgreSQL + 向量检索（ChromaDB）。

## 1. 现阶段能力概览

### 学生端
- 智能问答：支持多轮会话、对话分享、问答历史。
- 文件增强问答：支持上传文档/代码，解析后进入检索流程。
- 问卷作答：查看问卷、提交答案、查看个人结果。
- 学习计划：支持薄弱点分析与学习计划生成。
- 课程资料：查看、下载与预览教师上传资料。

### 教师端
- 教师看板：班级统计、趋势、最近问题、自定义洞察卡片。
- 课程与班级管理：课程创建、班级创建、学生名单查看。
- 资料与知识库：上传课程资料，构建课程级与全局检索。
- 问卷管理：手动创建、发布/撤回、批改、成绩发布。
- AI 问卷生成：支持通用 AI 生成与基于知识库生成（含流式接口）。

### Skills 与工作流
- 后端内置多类技能文件（概念讲解、代码分析、问卷生成等）。
- QA 流程已集成“意图识别 -> 知识检索 -> Skill 匹配 -> 回答生成”。

## 2. 仓库结构（核心部分）

```text
Vault/
├── README.md
├── Vault-doc.txt                  # 原始需求文档
├── backend/
│   ├── app/                       # FastAPI 主体
│   ├── database/                  # SQL 初始化/迁移脚本
│   ├── skills/                    # Skills（Markdown）
│   └── requirements.txt
├── frontend/
│   ├── src/                       # React + TS 前端
│   └── package.json
└── deploy/
    ├── backend.Dockerfile
    ├── docker-compose.prod.yml
    ├── frontend-nginx.conf
    └── nginx-http.conf
```

## 3. 技术栈

- 后端：FastAPI、SQLAlchemy、Pydantic v2、JWT、PostgreSQL
- 前端：React 18、TypeScript、Vite、React Router、Axios、Tailwind CSS
- 知识库/检索：ChromaDB（课程级 + 全局检索）
- 部署：Docker Compose + Nginx

## 4. 本地开发快速开始

### 4.1 环境要求
- Python 3.10+（建议与 `deploy/backend.Dockerfile` 保持一致）
- Node.js 18+
- PostgreSQL 14+

### 4.2 数据库初始化
1. 创建数据库 `app_project`
2. 在 `backend/` 目录执行以下二选一：
   - `database/full_export.sql`（推荐，完整结构）
   - `database/init.sql`（基础初始化）

示例（PowerShell）：

```powershell
cd backend
psql -U postgres -d app_project -f .\database\full_export.sql
```

### 4.3 启动后端

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端接口文档：
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health

### 4.4 启动前端

```powershell
cd frontend
npm install
npm run dev
```

前端默认地址：
- http://localhost:3000 或 http://localhost:5173

如需修改 API 地址，在 `frontend/.env.local` 配置：

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## 5. 配置说明

- 后端默认配置在 `backend/app/config/settings.py`。
- 生产环境建议全部改为环境变量注入（数据库、JWT 密钥、API Key）。
- 当前仓库含明文敏感信息的历史痕迹，部署前应统一轮换密钥并移除硬编码。

## 6. 与原始需求的对齐情况

- 学生/教师双端分离
- 问答 + 资料联动 + 问卷体系
- Skills 驱动的能力扩展
- 知识库检索能力（课程级与全局）

仍可继续增强的部分（建议作为 README Roadmap）：
- 更显式的知识图谱可视化与关系管理
- 学生“年度画像报告”自动生成
- 更完整的多 Agent/多模型协作策略
- 教师端基于画像的自动化编排能力（跨功能链路）

## 7. 部署说明（当前仓库状态）

- 主要编排文件：`deploy/docker-compose.prod.yml`
- 主要反代配置：`deploy/frontend-nginx.conf`、`deploy/nginx-http.conf`
- 默认端口映射：后端 `18000 -> 8000`，前端 `18080 -> 80`

注意：`deploy/docker-compose.prod.yml` 当前引用了 `deploy/frontend.Dockerfile`，但仓库中未提供该文件。生产部署前需要补齐前端 Dockerfile 或调整 compose 配置。

## 8. 子文档

- 后端详细文档：`backend/README.md`
- 前端详细文档：`frontend/README.md`

## 9. 维护建议

- 每次新增 API 路由时，同步更新“能力概览”和“部署/配置”段落。
- 每次新增 Skill 时，同步更新 `backend/skills/` 列表与适用场景说明。
- 将“已实现能力”和“规划能力”分开维护，避免 README 与实际代码偏离。
