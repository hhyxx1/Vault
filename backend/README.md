# 后端项目

基于 FastAPI 构建的智能教学平台后端服务。

## 技术栈

- **FastAPI** - 现代化的 Python Web 框架
- **Pydantic** - 数据验证和设置管理
- **SQLAlchemy** - ORM 数据库操作
- **Uvicorn** - ASGI 服务器

## 项目结构

```
app/
├── api/                 # API 路由
│   ├── student/         # 学生端接口
│   │   ├── qa.py        # 智能问答接口
│   │   └── survey.py    # 问卷接口
│   └── teacher/         # 教师端接口
│       ├── dashboard.py # 看板接口
│       └── survey.py    # 问卷管理接口
├── models/              # 数据模型
│   ├── user.py          # 用户模型
│   ├── qa.py            # 问答模型
│   └── survey.py        # 问卷模型
├── services/            # 业务逻辑层
│   ├── qa_service.py    # 问答服务
│   ├── survey_service.py # 问卷服务
│   └── dashboard_service.py # 看板服务
├── utils/               # 工具函数
│   └── helpers.py       # 辅助函数
├── config/              # 配置文件
│   └── settings.py      # 应用配置
└── main.py              # 应用入口
```

## 快速开始

### 创建虚拟环境

```bash
python -m venv venv
```

### 激活虚拟环境

Windows:
```bash
venv\Scripts\activate
```

Linux/Mac:
```bash
source venv/bin/activate
```

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动开发服务器

```bash
python app/main.py
```

或使用 uvicorn:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 端点

### 学生端

- `POST /api/student/qa/ask` - 提交问题
- `GET /api/student/qa/history` - 获取问答历史
- `GET /api/student/surveys` - 获取问卷列表
- `GET /api/student/surveys/{id}` - 获取问卷详情
- `POST /api/student/surveys/{id}/submit` - 提交问卷

### 教师端

- `GET /api/teacher/dashboard/stats` - 获取统计数据
- `GET /api/teacher/dashboard/recent-questions` - 获取最近提问
- `GET /api/teacher/surveys` - 获取问卷列表
- `POST /api/teacher/surveys` - 创建问卷
- `GET /api/teacher/surveys/{id}/results` - 获取问卷结果

## 环境变量

在项目根目录创建 `.env` 文件：

```env
DEBUG=True
DATABASE_URL=sqlite:///./education_platform.db
SECRET_KEY=your-secret-key
```

## 开发注意事项

1. 所有 API 接口都有对应的 Pydantic 模型进行数据验证
2. 使用服务层(services)处理业务逻辑
3. 数据库操作使用 SQLAlchemy ORM
4. API 文档自动生成，访问 /docs 查看
