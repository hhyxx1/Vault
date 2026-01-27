# 智能教学平台

基于 FastAPI + React + PostgreSQL 的智能教学管理系统，支持学生问答、教师管理、问卷调查等功能。

## 技术栈

### 后端
- **框架**: FastAPI 0.109.0
- **数据库**: PostgreSQL 18
- **ORM**: SQLAlchemy 2.0.25
- **认证**: JWT (python-jose) + bcrypt
- **Python版本**: 3.12+

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI**: Tailwind CSS
- **路由**: React Router
- **HTTP客户端**: Axios

## 快速开始

### 1. 环境要求
- Python 3.12+
- Node.js 16+
- PostgreSQL 18

### 2. 安装PostgreSQL
1. 下载PostgreSQL 18：https://www.postgresql.org/download/
2. 安装时设置密码（例如：123456）
3. 记住端口号（默认：5432）

### 3. 创建数据库
打开PostgreSQL命令行或pgAdmin 4：
```sql
CREATE DATABASE app_project;
```

然后执行数据库初始化脚本（位于项目根目录的 `init.sql`）。

### 4. 后端启动

#### 安装依赖
```bash
cd backend
pip install -r requirements.txt
```

#### 配置数据库
修改 `backend/app/config/settings.py` 中的数据库密码：
```python
DATABASE_URL: str = "postgresql+psycopg://postgres:你的密码@localhost:5432/app_project"
```

#### 运行服务
```bash
python app/main.py
```

后端将运行在 `http://localhost:8000`
- API文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 5. 前端启动

#### 安装依赖
```bash
cd frontend
npm install
```

#### 运行开发服务器
```bash
npm run dev
```

前端将运行在 `http://localhost:3000`（或 `http://localhost:5173`）

### 6. 注册测试账号

#### 学生账号
1. 访问 http://localhost:3000/register
2. 选择"学生"身份
3. 填写信息：
   - 用户名：student001
   - 邮箱：student@example.com
   - 真实姓名：张三
   - 密码：123456（至少6位）
   - 学号：S202100001（必填）
   - 专业：计算机科学（必填）
   - 年级：2021（必填）

#### 教师账号
1. 访问 http://localhost:3000/register
2. 选择"教师"身份
3. 填写信息：
   - 用户名：teacher001
   - 邮箱：teacher@example.com
   - 真实姓名：李老师
   - 密码：123456（至少6位）
   - 工号：T202100001（必填）
   - 院系：计算机学院（必填）
   - 职称：副教授（必填）

## 项目结构

```
project/
├── backend/                 # 后端服务
│   ├── app/
│   │   ├── api/            # API路由
│   │   │   ├── auth.py     # 认证（登录/注册）
│   │   │   ├── student/    # 学生端API
│   │   │   └── teacher/    # 教师端API
│   │   ├── config/         # 配置文件
│   │   ├── models/         # 数据库模型
│   │   ├── schemas/        # Pydantic模型
│   │   ├── services/       # 业务逻辑
│   │   ├── utils/          # 工具函数
│   │   ├── database.py     # 数据库连接
│   │   └── main.py         # 应用入口
│   └── requirements.txt    # Python依赖
│
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── layouts/        # 布局组件
│   │   ├── pages/          # 页面组件
│   │   │   ├── Login/      # 登录页
│   │   │   ├── Register/   # 注册页
│   │   │   ├── student/    # 学生端页面
│   │   │   └── teacher/    # 教师端页面
│   │   ├── router/         # 路由配置
│   │   ├── services/       # API服务
│   │   └── types/          # TypeScript类型
│   └── package.json        # 前端依赖
│
└── init.sql                # 数据库初始化脚本
```

## 功能模块

### 已实现
- ✅ 用户注册（学生/教师）
- ✅ 用户登录（JWT认证）
- ✅ 角色权限控制
- ✅ 密码加密存储
- ✅ 响应式UI设计

### 待实现
- ⏳ 学生问答系统
- ⏳ 教师管理面板
- ⏳ 问卷调查功能
- ⏳ 知识库管理
- ⏳ 数据统计分析

## 常见问题

### 1. 数据库连接失败
- 检查PostgreSQL是否运行
- 确认数据库密码正确
- 确认数据库 `app_project` 已创建

### 2. 登录失败
- 确认用户名拼写正确
- 确认密码正确（注册时设置的密码）
- 检查后端日志查看具体错误

### 3. 端口被占用
- 后端端口8000被占用：修改 `backend/app/config/settings.py` 中的 `PORT`
- 前端端口被占用：修改 `frontend/vite.config.ts` 中的 `server.port`

### 4. 模块导入错误
- 确认已安装所有依赖：`pip install -r requirements.txt`
- 确认Python版本为3.12+

## 开发说明

### 添加新API
1. 在 `backend/app/api/` 创建路由文件
2. 在 `backend/app/main.py` 注册路由
3. 在 `frontend/src/services/` 添加API调用

### 数据库迁移
修改模型后需要手动更新数据库结构，或使用Alembic进行迁移。

### 代码规范
- 后端：遵循PEP 8
- 前端：使用ESLint + Prettier

## License
MIT

## 联系方式
如有问题请提Issue
