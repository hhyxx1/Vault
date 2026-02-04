from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional, Union
import shutil
import os
from pathlib import Path

from app.database import get_db
from app.models.user import User, Student
from app.utils.auth import get_current_user
from pydantic import BaseModel, Field

router = APIRouter()

# Pydantic schemas
class StudentProfileResponse(BaseModel):
    id: str
    username: str
    full_name: str
    email: str
    avatar_url: Union[str, None]
    student_number: str
    major: Union[str, None]
    grade: Union[str, None]
    class_name: Union[str, None]
    total_questions: int
    total_scores: float
    join_date: Union[str, None]

    class Config:
        from_attributes = True

class StudentProfileUpdate(BaseModel):
    full_name: str = Field(..., description="真实姓名")
    email: str = Field(..., description="电子邮箱")
    major: str = Field(..., description="专业")
    grade: str = Field(..., description="年级")

@router.get("/", response_model=StudentProfileResponse)
async def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取学生个人资料"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    
    # 从数据库查询完整的用户信息
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    student = db_user.student
    if not student:
        raise HTTPException(status_code=404, detail="未找到学生信息")
        
    return StudentProfileResponse(
        id=str(db_user.id),
        username=db_user.username,
        full_name=db_user.full_name or db_user.username,
        email=db_user.email,
        avatar_url=db_user.avatar_url,
        student_number=student.student_number,
        major=student.major,
        grade=student.grade,
        class_name=student.class_name,
        total_questions=student.total_questions,
        total_scores=float(student.total_scores),
        join_date=student.created_at.strftime("%Y-%m-%d") if student.created_at else None
    )

@router.put("/", response_model=StudentProfileResponse)
async def update_student_profile(
    profile_data: StudentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新学生个人资料"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    
    # 从数据库查询完整的用户信息
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    student = db_user.student
    if not student:
        raise HTTPException(status_code=404, detail="未找到学生信息")
    
    # 检查邮箱是否被其他用户使用
    if profile_data.email != db_user.email:
        existing_user = db.query(User).filter(
            User.email == profile_data.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="该邮箱已被使用")
    
    # 更新 User 表
    db_user.full_name = profile_data.full_name
    db_user.email = profile_data.email
    
    # 更新 Student 表
    student.major = profile_data.major
    student.grade = profile_data.grade
    
    db.commit()
    db.refresh(db_user)
    db.refresh(student)
    
    return StudentProfileResponse(
        id=str(db_user.id),
        username=db_user.username,
        full_name=db_user.full_name,
        email=db_user.email,
        avatar_url=db_user.avatar_url,
        student_number=student.student_number,
        major=student.major,
        grade=student.grade,
        class_name=student.class_name,
        total_questions=student.total_questions,
        total_scores=float(student.total_scores),
        join_date=student.created_at.strftime("%Y-%m-%d") if student.created_at else None
    )

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传头像"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以上传头像")
        
    # 验证文件类型
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="只能上传图片文件")
        
    try:
        # 保存文件 - 使用绝对路径
        # 获取backend目录的绝对路径
        backend_dir = Path(__file__).resolve().parent.parent.parent
        upload_dir = backend_dir / "app" / "static" / "avatars"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Upload directory: {upload_dir}")
        print(f"File: {file.filename}, Content-Type: {file.content_type}")
        
        # 生成文件名 - 使用用户ID作为文件名
        file_ext = os.path.splitext(file.filename)[1].lower()
        if not file_ext or file_ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            file_ext = ".jpg"  # 默认扩展名
            
        # 删除该用户已有的所有头像文件（覆盖旧头像）
        try:
            for existing_file in upload_dir.iterdir():
                if existing_file.is_file() and existing_file.stem == str(current_user.id):
                    print(f"Deleting old avatar: {existing_file}")
                    os.remove(existing_file)
        except Exception as e:
            print(f"Error deleting old avatar: {e}")

        filename = f"{current_user.id}{file_ext}"
        file_path = upload_dir / filename
        
        print(f"Saving avatar to: {file_path}")
        
        # 保存文件
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"Avatar saved successfully: {file_path.exists()}")
            
        # 更新用户头像URL - 从数据库查询完整的用户对象
        db_user = db.query(User).filter(User.id == current_user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        base_url = f"http://localhost:8000/static/avatars/{filename}"
        db_user.avatar_url = base_url
        db.commit()
        db.refresh(db_user)
        
        print(f"Database updated: avatar_url = {base_url}")
        
        return {"avatar_url": base_url}
    except Exception as e:
        print(f"Error uploading avatar: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"上传头像失败: {str(e)}")
