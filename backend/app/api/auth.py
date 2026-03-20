from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Student, Teacher
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.utils.auth import get_password_hash, verify_password, create_access_token, get_current_user
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, EmailStr
import random
import string

router = APIRouter(prefix="/api/auth", tags=["认证"])

# 存储验证码（生产环境应使用Redis）
password_reset_codes: dict = {}

class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    current_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., min_length=6, description="新密码")
    confirm_password: str = Field(..., description="确认新密码")

class SendResetCodeRequest(BaseModel):
    """发送重置密码验证码请求"""
    email: EmailStr = Field(..., description="注册邮箱")

class VerifyResetCodeRequest(BaseModel):
    """验证重置密码验证码请求"""
    email: EmailStr = Field(..., description="注册邮箱")
    code: str = Field(..., min_length=6, max_length=6, description="验证码")

class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    email: EmailStr = Field(..., description="注册邮箱")
    code: str = Field(..., min_length=6, max_length=6, description="验证码")
    new_password: str = Field(..., min_length=6, description="新密码")

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """用户注册"""
    
    # 检查用户名是否已存在
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    # 在创建用户之前先检查学号/工号是否已存在
    if request.role == 'student':
        if not request.student_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="学生账号必须提供学号"
            )
        # 检查学号是否已存在
        existing_student = db.query(Student).filter(
            Student.student_number == request.student_number
        ).first()
        if existing_student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="学号已存在"
            )
    elif request.role == 'teacher':
        if not request.teacher_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="教师账号必须提供工号"
            )
        # 检查工号是否已存在
        existing_teacher = db.query(Teacher).filter(
            Teacher.teacher_number == request.teacher_number
        ).first()
        if existing_teacher:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="工号已存在"
            )
    
    # 创建用户
    hashed_password = get_password_hash(request.password)
    new_user = User(
        username=request.username,
        email=request.email,
        password_hash=hashed_password,
        role=request.role,
        full_name=request.full_name,
        is_active=True
    )
    
    db.add(new_user)
    db.flush()  # 获取生成的ID
    
    # 根据角色创建对应的学生或教师记录
    if request.role == 'student':
        student = Student(
            user_id=new_user.id,
            student_number=request.student_number,
            major=request.major,
            grade=request.grade
        )
        db.add(student)
        
    elif request.role == 'teacher':
        
        teacher = Teacher(
            user_id=new_user.id,
            teacher_number=request.teacher_number,
            department=request.department,
            title=request.title
        )
        db.add(teacher)
    
    db.commit()
    db.refresh(new_user)
    
    # 生成访问令牌
    access_token = create_access_token(
        data={"sub": new_user.username, "user_id": str(new_user.id), "role": new_user.role}
    )
    
    # 准备用户信息
    user_data = {
        "id": str(new_user.id),
        "username": new_user.username,
        "email": new_user.email,
        "role": new_user.role,
        "full_name": new_user.full_name
    }
    
    if request.role == 'student':
        user_data["student_number"] = request.student_number
        user_data["major"] = request.major
        user_data["grade"] = request.grade
    elif request.role == 'teacher':
        user_data["teacher_number"] = request.teacher_number
        user_data["department"] = request.department
        user_data["title"] = request.title
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_data
    )

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    
    # 查找用户
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    # 验证密码
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    # 检查用户是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用"
        )
    
    # 更新最后登录时间
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    # 生成访问令牌
    access_token = create_access_token(
        data={"sub": user.username, "user_id": str(user.id), "role": user.role}
    )
    
    # 准备用户信息
    user_data = {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url
    }
    
    # 获取角色相关信息
    if user.role == 'student' and user.student:
        user_data["student_number"] = user.student.student_number
        user_data["major"] = user.student.major
        user_data["grade"] = user.student.grade
    elif user.role == 'teacher' and user.teacher:
        user_data["teacher_number"] = user.teacher.teacher_number
        user_data["department"] = user.teacher.department
        user_data["title"] = user.teacher.title
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_data
    )

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """修改密码"""
    
    # 验证新密码和确认密码是否一致
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密码和确认密码不一致"
        )
    
    # 从数据库获取完整的用户信息（包括密码哈希）
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 验证当前密码是否正确
    if not verify_password(request.current_password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前密码不正确"
        )
    
    # 加密新密码
    new_password_hash = get_password_hash(request.new_password)
    
    # 更新密码
    db_user.password_hash = new_password_hash
    db_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "密码修改成功"}

def generate_verification_code() -> str:
    """生成6位数字验证码"""
    return ''.join(random.choices(string.digits, k=6))

async def send_email_async(email: str, code: str):
    """
    发送邮件的异步函数
    注意：这里是模拟发送邮件，实际生产环境需要配置SMTP服务器
    """
    # TODO: 配置实际的邮件发送服务
    # 可以使用 smtplib, aiosmtplib, 或第三方服务如 SendGrid, AWS SES 等
    print(f"[模拟邮件] 向 {email} 发送验证码: {code}")
    # 实际实现示例：
    # import aiosmtplib
    # from email.mime.text import MIMEText
    # msg = MIMEText(f"您的密码重置验证码是：{code}，有效期10分钟。")
    # msg['Subject'] = '智能教学平台 - 密码重置验证码'
    # msg['From'] = 'noreply@example.com'
    # msg['To'] = email
    # await aiosmtplib.send(msg, hostname='smtp.example.com', port=587)

@router.post("/send-reset-code")
async def send_reset_code(
    request: SendResetCodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """发送密码重置验证码"""
    
    # 查找用户
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该邮箱未注册"
        )
    
    # 检查是否在短时间内重复发送
    if request.email in password_reset_codes:
        last_sent = password_reset_codes[request.email].get('sent_at')
        if last_sent and datetime.utcnow() - last_sent < timedelta(seconds=60):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="请求过于频繁，请稍后再试"
            )
    
    # 生成验证码
    code = generate_verification_code()
    
    # 存储验证码（有效期10分钟）
    password_reset_codes[request.email] = {
        'code': code,
        'expires_at': datetime.utcnow() + timedelta(minutes=10),
        'sent_at': datetime.utcnow(),
        'verified': False
    }
    
    # 异步发送邮件
    background_tasks.add_task(send_email_async, request.email, code)
    
    return {"message": "验证码已发送至您的邮箱"}

@router.post("/verify-reset-code")
async def verify_reset_code(
    request: VerifyResetCodeRequest,
    db: Session = Depends(get_db)
):
    """验证密码重置验证码"""
    
    # 检查验证码是否存在
    if request.email not in password_reset_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先发送验证码"
        )
    
    stored_data = password_reset_codes[request.email]
    
    # 检查验证码是否过期
    if datetime.utcnow() > stored_data['expires_at']:
        del password_reset_codes[request.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码已过期，请重新发送"
        )
    
    # 验证验证码
    if stored_data['code'] != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误"
        )
    
    # 标记验证码已验证
    password_reset_codes[request.email]['verified'] = True
    
    return {"message": "验证成功"}

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """重置密码"""
    
    # 检查验证码是否存在且已验证
    if request.email not in password_reset_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先验证邮箱"
        )
    
    stored_data = password_reset_codes[request.email]
    
    # 检查验证码是否已验证
    if not stored_data.get('verified'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先验证邮箱"
        )
    
    # 检查验证码是否过期
    if datetime.utcnow() > stored_data['expires_at']:
        del password_reset_codes[request.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码已过期，请重新发送"
        )
    
    # 再次验证验证码
    if stored_data['code'] != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误"
        )
    
    # 查找用户
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新密码
    user.password_hash = get_password_hash(request.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # 删除已使用的验证码
    del password_reset_codes[request.email]
    
    return {"message": "密码重置成功"}
