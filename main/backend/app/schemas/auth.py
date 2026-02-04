from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime

# 注册请求模型
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field(..., max_length=100)
    role: Literal['student', 'teacher']
    
    # 学生特有字段
    student_number: Optional[str] = None
    major: Optional[str] = None
    grade: Optional[str] = None
    
    # 教师特有字段
    teacher_number: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None

# 登录请求模型
class LoginRequest(BaseModel):
    username: str
    password: str

# Token响应模型
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# 用户响应模型
class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# 学生响应模型
class StudentResponse(UserResponse):
    student_number: str
    major: Optional[str]
    grade: Optional[str]

# 教师响应模型
class TeacherResponse(UserResponse):
    teacher_number: str
    department: Optional[str]
    title: Optional[str]
