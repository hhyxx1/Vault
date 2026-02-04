# 后端安装与运行指南

## 环境要求
- Python 3.12 或更高版本
- PostgreSQL 18
- pip 包管理器

## 安装步骤

### 1. 安装Python依赖

```bash
# 进入backend目录
cd backend

# 安装所有依赖
pip install -r requirements.txt
```

**注意事项：**
- 安装过程可能需要5-10分钟
- 如果遇到网络问题，可使用国内镜像：
  ```bash
  pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
  ```
- 某些包需要C++编译器，Windows用户需要安装 Visual C++ Build Tools

### 2. 配置数据库

#### 修改数据库密码
编辑 `app/config/settings.py`，将数据库密码改为你PostgreSQL的实际密码：

```python
DATABASE_URL: str = "postgresql+psycopg://postgres:你的密码@localhost:5432/app_project"
```

#### 创建数据库
在PostgreSQL中创建数据库：

```sql
CREATE DATABASE app_project;
```

#### 初始化数据库表
执行项目根目录下的 `init.sql` 文件：
- 使用pgAdmin 4：打开Query Tool → 粘贴SQL → 执行
- 使用命令行：`psql -U postgres -d app_project -f ../init.sql`

### 3. 启动服务

```bash
# 方式1：直接运行
python app/main.py

# 方式2：使用uvicorn（推荐生产环境）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 验证安装

#### 访问API文档
打开浏览器访问：http://localhost:8000/docs

你应该能看到Swagger UI界面，显示所有可用的API端点。

#### 测试健康检查
```bash
curl http://localhost:8000/health
```

应该返回：`{"status": "ok"}`

#### 测试注册API
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "123456",
    "full_name": "测试用户",
    "role": "student",
    "student_number": "S001",
    "major": "计算机",
    "grade": "2024"
  }'
```

## 项目结构说明

```
backend/
├── app/
│   ├── api/              # API路由层
│   │   ├── auth.py       # ✅ 认证API（登录/注册）- 已完成
│   │   ├── student/      # 学生端API
│   │   │   ├── qa.py     # ⏳ 问答API - TODO
│   │   │   └── survey.py # ⏳ 问卷API - TODO
│   │   └── teacher/      # 教师端API
│   │       ├── dashboard.py # ⏳ 看板API - TODO
│   │       └── survey.py    # ⏳ 问卷API - TODO
│   │
│   ├── config/           # 配置
│   │   └── settings.py   # ✅ 应用配置
│   │
│   ├── models/           # 数据库模型
│   │   ├── user.py       # ✅ 用户/学生/教师模型
│   │   ├── qa.py         # ✅ 问答模型
│   │   └── survey.py     # ✅ 问卷模型
│   │
│   ├── schemas/          # Pydantic数据验证
│   │   └── auth.py       # ✅ 认证相关Schema
│   │
│   ├── services/         # 业务逻辑层
│   │   ├── qa_service.py            # ⏳ 问答服务 - TODO
│   │   ├── knowledge_base_service.py # ⏳ 知识库服务 - TODO
│   │   ├── survey_service.py         # ⏳ 问卷服务 - TODO
│   │   └── dashboard_service.py      # ⏳ 看板服务 - TODO
│   │
│   ├── utils/            # 工具函数
│   │   ├── auth.py       # ✅ 密码加密/JWT生成
│   │   └── helpers.py    # 通用工具函数
│   │
│   ├── database.py       # ✅ 数据库连接
│   └── main.py           # ✅ 应用入口
│
└── requirements.txt      # Python依赖清单
```

## 依赖包说明

### 核心依赖
- **fastapi**: Web框架，提供高性能API服务
- **uvicorn**: ASGI服务器，运行FastAPI应用
- **pydantic**: 数据验证和序列化
- **sqlalchemy**: ORM框架，数据库操作
- **psycopg**: PostgreSQL数据库驱动（版本3，解决中文路径问题）

### 认证相关
- **python-jose**: JWT令牌生成和验证
- **passlib**: 密码哈希加密
- **bcrypt**: bcrypt哈希算法

### 可选依赖
- **pgvector**: PostgreSQL向量扩展（知识库功能需要）
- **chromadb**: 向量数据库（知识库功能需要）

如不需要知识库功能，可在requirements.txt中注释掉这两项。

## 常见问题

### 1. psycopg安装失败
**错误**: `ERROR: Could not build wheels for psycopg`

**解决方案**:
- Windows: 安装 Microsoft C++ Build Tools
- Linux: `sudo apt-get install libpq-dev python3-dev`
- macOS: `brew install postgresql`

### 2. bcrypt版本警告
**警告**: `error reading bcrypt version`

这是一个警告，不影响功能。bcrypt 4.x版本的模块结构变化导致。

### 3. 数据库连接失败
**错误**: `UnicodeDecodeError` 或 `connection refused`

**检查清单**:
- ✅ PostgreSQL服务是否运行
- ✅ 数据库密码是否正确
- ✅ 数据库 `app_project` 是否已创建
- ✅ 防火墙是否阻止端口5432

### 4. 导入错误
**错误**: `ModuleNotFoundError: No module named 'app'`

**解决方案**:
确保在backend目录下运行，或设置PYTHONPATH：
```bash
export PYTHONPATH="${PYTHONPATH}:${PWD}"  # Linux/Mac
set PYTHONPATH=%PYTHONPATH%;%CD%         # Windows
```

## 开发模式

### 启用热重载
```bash
uvicorn app.main:app --reload
```

代码修改后自动重启服务。

### 查看SQL日志
在 `app/config/settings.py` 中设置：
```python
DEBUG: bool = True
```

会在控制台输出所有SQL语句，方便调试。

### 禁用CORS（生产环境）
在 `app/main.py` 中修改：
```python
allow_origins=["https://your-production-domain.com"]
```

## 生产部署建议

1. 使用环境变量存储敏感信息（密码、SECRET_KEY）
2. 设置 `DEBUG=False`
3. 使用Gunicorn作为进程管理器
4. 配置NGINX作为反向代理
5. 启用HTTPS
6. 设置合理的数据库连接池大小

## 联系与支持
如遇到问题，请查看项目根目录的README.md或提交Issue。
