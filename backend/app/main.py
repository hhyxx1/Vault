import sys
import os
from pathlib import Path

# 设置环境变量强制UTF-8编码，解决PostgreSQL路径中文问题
os.environ['PGCLIENTENCODING'] = 'UTF8'
os.environ.setdefault('LANG', 'en_US.UTF-8')
os.environ.setdefault('LC_ALL', 'en_US.UTF-8')

# 添加项目根目录到Python路径
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.auth import router as auth_router
from app.api.student import qa as student_qa, survey as student_survey, class_enrollment as student_class
from app.api.teacher import dashboard, survey as teacher_survey, profile as teacher_profile

app = FastAPI(
    title="智能教学平台 API",
    description="智能教学平台后端服务",
    version="1.0.0"
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"📨 收到请求: {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"✅ 响应: {request.method} {request.url.path} - {response.status_code}")
    return response

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000", 
        "http://localhost:3001"  # 添加3001端口支持
    ],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务
static_dir = backend_dir / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# 注册路由
app.include_router(auth_router)  # 认证路由
app.include_router(student_qa.router, prefix="/api/student/qa", tags=["学生-问答"])
app.include_router(student_survey.router, prefix="/api/student/surveys", tags=["学生-问卷"])
app.include_router(student_class.router, prefix="/api/student/classes", tags=["学生-班级"])
app.include_router(dashboard.router, prefix="/api/teacher/dashboard", tags=["教师-看板"])
app.include_router(teacher_survey.router, prefix="/api/teacher/surveys", tags=["教师-问卷"])
app.include_router(teacher_profile.router, prefix="/api/teacher/profile", tags=["教师-个人资料"])

@app.get("/")
async def root():
    return {
        "message": "智能教学平台 API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("🚀 启动智能教学平台后端服务")
    print("=" * 70)
    print("📍 服务地址: http://127.0.0.1:8000")
    print("📚 API文档: http://127.0.0.1:8000/docs")
    print("🔄 热重载: 已启用")
    print("💾 向量数据库: 自动初始化中...")
    print("=" * 70)
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"]
    )
