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
from app.api.student import qa as student_qa, survey as student_survey, class_enrollment as student_class, profile as student_profile, course_documents as student_course_docs, learning_plan as student_learning_plan
from app.api.teacher import dashboard, survey as teacher_survey, profile as teacher_profile, knowledge_base as teacher_kb, survey_generation, documents as teacher_docs

app = FastAPI(
    title="智能教学平台 API",
    description="智能教学平台后端服务",
    version="1.0.0"
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"[REQ] {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"[RES] {request.method} {request.url.path} - {response.status_code}")
    return response

# CORS配置（确保错误响应也带 CORS 头，避免前端报跨域）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://8.159.151.36:18080",
        "https://ai4teaching.cn",
        "https://www.ai4teaching.cn",
        "https://demo.ai4teaching.cn"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 静态文件服务 - 统一指向 app/api/static 目录
static_dir = backend_dir / "app" / "api" / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# 注册路由
app.include_router(auth_router)  # 认证路由
app.include_router(student_qa.router, prefix="/api/student/qa", tags=["学生-问答"])
app.include_router(student_survey.router, prefix="/api/student/surveys", tags=["学生-问卷"])
app.include_router(student_class.router, prefix="/api/student/classes", tags=["学生-班级"])
app.include_router(student_profile.router, prefix="/api/student/profile", tags=["学生-个人资料"])
app.include_router(student_course_docs.router, prefix="/api/student/courses", tags=["学生-课程资料"])
app.include_router(student_learning_plan.router, prefix="/api/student/learning-plan", tags=["学生-学习计划"])
app.include_router(dashboard.router, prefix="/api/teacher/dashboard", tags=["教师-看板"])
app.include_router(teacher_survey.router, prefix="/api/teacher/surveys", tags=["教师-问卷"])
app.include_router(teacher_profile.router, prefix="/api/teacher/profile", tags=["教师-个人资料"])
app.include_router(teacher_kb.router, prefix="/api/teacher/knowledge-base", tags=["教师-知识库"])
app.include_router(survey_generation.router, prefix="/api/teacher/survey-generation", tags=["教师-AI问卷生成"])
app.include_router(teacher_docs.router, prefix="/api/teacher", tags=["教师-文档管理"])

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
    import io
    # 修复Windows控制台编码问题
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    print("=" * 70)
    print("[*] Starting Intelligent Teaching Platform Backend")
    print("=" * 70)
    print("[>] Server: http://127.0.0.1:8000")
    print("[>] API Docs: http://127.0.0.1:8000/docs")
    print("[>] Hot Reload: Enabled")
    print("[>] Vector DB: Initializing...")
    print("=" * 70)
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"]
    )
