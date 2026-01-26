# 智能教学平台

一个基于 React + FastAPI 构建的智能教学平台，提供学生端和教师端的完整功能。

## 📋 项目概述

本项目是一个前后端分离的企业级智能教学平台，主要功能包括：

### 学生端
- 🤖 **智能问答**：学生可以提问，系统提供AI智能回答
- 📝 **问卷调查**：参与课程反馈和各类调查

### 教师端
- 📊 **教师看板**：查看学生统计数据、最近提问等
- 📋 **问卷管理**：创建、管理和查看问卷结果

## 🏗️ 项目结构

```
project/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   │   ├── student/      # 学生端页面
│   │   │   │   ├── QA/       # 智能问答页面
│   │   │   │   └── Survey/   # 问卷调查页面
│   │   │   └── teacher/      # 教师端页面
│   │   │       ├── Dashboard/ # 教师看板页面
│   │   │       └── Survey/    # 问卷管理页面
│   │   ├── layouts/          # 布局组件
│   │   │   ├── StudentLayout.tsx  # 学生端布局
│   │   │   └── TeacherLayout.tsx  # 教师端布局
│   │   ├── components/       # 公共组件（可复用组件）
│   │   ├── router/           # 路由配置
│   │   ├── services/         # API服务层（前端请求封装）
│   │   ├── hooks/            # 自定义React Hooks
│   │   ├── types/            # TypeScript类型定义
│   │   ├── utils/            # 工具函数
│   │   └── assets/           # 静态资源（图片、字体等）
│   ├── public/               # 公共静态文件
│   ├── package.json          # 前端依赖配置
│   ├── vite.config.ts        # Vite配置
│   ├── tsconfig.json         # TypeScript配置
│   ├── tailwind.config.js    # Tailwind CSS配置
│   └── README.md             # 前端项目说明
│
├── backend/                  # 后端项目
│   ├── app/
│   │   ├── api/              # API路由层
│   │   │   ├── student/      # 学生端API
│   │   │   │   ├── qa.py     # 问答接口
│   │   │   │   └── survey.py # 问卷接口
│   │   │   └── teacher/      # 教师端API
│   │   │       ├── dashboard.py  # 看板接口
│   │   │       └── survey.py     # 问卷管理接口
│   │   ├── models/           # 数据模型层（ORM模型）
│   │   │   ├── user.py       # 用户模型
│   │   │   ├── qa.py         # 问答记录模型
│   │   │   └── survey.py     # 问卷模型
│   │   ├── services/         # 业务逻辑层
│   │   │   ├── qa_service.py      # 问答业务逻辑
│   │   │   ├── survey_service.py  # 问卷业务逻辑
│   │   │   └── dashboard_service.py # 看板业务逻辑
│   │   ├── utils/            # 工具函数
│   │   │   └── helpers.py    # 辅助工具
│   │   ├── config/           # 配置文件
│   │   │   └── settings.py   # 应用配置
│   │   └── main.py           # FastAPI应用入口
│   ├── tests/                # 测试文件目录
│   ├── requirements.txt      # Python依赖
│   ├── .env                  # 环境变量配置
│   └── README.md             # 后端项目说明
│
└── README.md                 # 项目总说明文档（本文件）
```

## 📁 目录说明

### 前端目录详解

| 目录/文件 | 说明 |
|---------|------|
| `src/pages/` | **页面组件**：每个路由对应的页面组件，按业务模块分类 |
| `src/layouts/` | **布局组件**：页面的整体布局框架，包含导航栏等公共部分 |
| `src/components/` | **公共组件**：可复用的UI组件，如按钮、表单、卡片等 |
| `src/router/` | **路由配置**：定义应用的路由规则和页面跳转逻辑 |
| `src/services/` | **API服务**：封装后端API调用，统一管理HTTP请求 |
| `src/hooks/` | **自定义Hooks**：可复用的React状态逻辑 |
| `src/types/` | **类型定义**：TypeScript接口和类型定义 |
| `src/utils/` | **工具函数**：通用的辅助函数，如日期格式化等 |
| `src/assets/` | **静态资源**：图片、图标、字体等静态文件 |

### 后端目录详解

| 目录/文件 | 说明 |
|---------|------|
| `app/api/` | **API路由层**：定义HTTP端点和请求响应处理 |
| `app/models/` | **数据模型层**：定义数据库表结构（ORM模型） |
| `app/services/` | **业务逻辑层**：核心业务逻辑处理，连接API和数据层 |
| `app/utils/` | **工具函数**：通用辅助函数 |
| `app/config/` | **配置管理**：应用配置、环境变量管理 |
| `tests/` | **测试代码**：单元测试和集成测试 |

## 🚀 技术栈

### 前端
- **React 18** - 用户界面库
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 快速的前端构建工具
- **React Router** - 单页应用路由管理
- **Tailwind CSS** - 实用优先的CSS框架
- **Axios** - HTTP客户端

### 后端
- **FastAPI** - 现代化的Python Web框架
- **Pydantic** - 数据验证和设置管理
- **SQLAlchemy** - Python ORM框架
- **Uvicorn** - ASGI服务器

## 🎯 快速开始

### 前提条件
- Node.js >= 16
- Python >= 3.9
- npm 或 yarn

### 1. 启动后端服务

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python app/main.py
```

后端服务将运行在 http://localhost:8000

API文档：http://localhost:8000/docs

### 2. 启动前端服务

```bash
# 新开一个终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将运行在 http://localhost:3000

## 📡 API接口说明

### 学生端接口
- `POST /api/student/qa/ask` - 提交问题获取AI回答
- `GET /api/student/qa/history` - 获取问答历史
- `GET /api/student/surveys` - 获取可用问卷列表
- `POST /api/student/surveys/{id}/submit` - 提交问卷答案

### 教师端接口
- `GET /api/teacher/dashboard/stats` - 获取统计数据
- `GET /api/teacher/dashboard/recent-questions` - 获取最近提问
- `GET /api/teacher/surveys` - 获取问卷列表
- `POST /api/teacher/surveys` - 创建新问卷
- `GET /api/teacher/surveys/{id}/results` - 查看问卷结果

## 🔧 开发指南

### 前端开发
1. 所有页面组件放在 `src/pages/` 下对应的模块目录
2. 公共组件放在 `src/components/`
3. API调用统一使用 `src/services/` 中封装的方法
4. 使用TypeScript确保类型安全
5. 遵循Tailwind CSS的实用类命名规范

### 后端开发
1. API端点定义在 `app/api/` 下的路由文件中
2. 业务逻辑放在 `app/services/` 中
3. 数据库模型定义在 `app/models/` 中
4. 使用Pydantic进行请求/响应数据验证
5. 所有API自动生成文档（访问 /docs）

## 📝 企业级开发规范

### 架构设计
- ✅ 前后端分离架构
- ✅ 三层架构：API层 → 服务层 → 数据层
- ✅ RESTful API设计
- ✅ 统一的错误处理和响应格式

### 代码规范
- ✅ TypeScript类型检查
- ✅ ESLint代码规范
- ✅ 模块化组件设计
- ✅ 清晰的目录结构

### 安全性
- ✅ CORS跨域配置
- ✅ 环境变量管理
- ✅ API数据验证

## 📚 后续开发建议

1. **认证授权**：集成JWT身份验证
2. **数据库**：连接实际数据库（PostgreSQL/MySQL）
3. **AI集成**：接入实际的AI问答模型
4. **文件上传**：支持图片、文档上传
5. **实时通信**：WebSocket实时消息推送
6. **测试**：添加单元测试和E2E测试
7. **部署**：Docker容器化部署

## 📄 许可证

本项目仅供学习和开发使用。

## 👥 贡献

欢迎提交问题和改进建议！
