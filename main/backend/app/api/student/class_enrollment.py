from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.course import Course, Class
from app.utils.auth import get_current_user

router = APIRouter()

# Pydantic schemas
class JoinClassRequest(BaseModel):
    invite_code: str

class ClassInfo(BaseModel):
    id: str
    class_name: str
    course_id: str
    course_name: str
    course_code: str
    teacher_name: str
    academic_year: str
    max_students: int
    current_students: int
    enrollment_date: str
    
    class Config:
        from_attributes = True

@router.post("/join", response_model=ClassInfo)
async def join_class_by_invite_code(
    request: JoinClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """学生通过邀请码加入班级"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以加入班级")
    
    # 查找班级
    class_obj = db.query(Class).filter(
        Class.invite_code == request.invite_code.upper(),
        Class.status == 'active'
    ).first()
    
    if not class_obj:
        raise HTTPException(status_code=404, detail="邀请码无效或班级不存在")
    
    # 检查是否允许自主加入
    if not class_obj.allow_self_enroll:
        raise HTTPException(status_code=403, detail="该班级不允许通过邀请码加入")
    
    # 检查是否已经加入
    from sqlalchemy import text
    existing = db.execute(
        text("SELECT id FROM class_students WHERE class_id = :class_id AND student_id = :student_id"),
        {"class_id": str(class_obj.id), "student_id": str(current_user.id)}
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="您已经加入了该班级")
    
    # 检查班级人数是否已满
    current_count = db.execute(
        text("SELECT COUNT(*) FROM class_students WHERE class_id = :class_id AND status = 'active'"),
        {"class_id": str(class_obj.id)}
    ).scalar()
    
    if current_count >= class_obj.max_students:
        raise HTTPException(status_code=400, detail="班级人数已满")
    
    # 加入班级
    db.execute(
        text("""
            INSERT INTO class_students (id, class_id, student_id, enrollment_date, status)
            VALUES (uuid_generate_v4(), :class_id, :student_id, :enrollment_date, 'active')
        """),
        {
            "class_id": str(class_obj.id),
            "student_id": str(current_user.id),
            "enrollment_date": datetime.utcnow()
        }
    )
    db.commit()
    
    # 获取课程和教师信息
    course = db.query(Course).filter(Course.id == class_obj.course_id).first()
    teacher = db.query(User).filter(User.id == class_obj.teacher_id).first()
    
    return ClassInfo(
        id=str(class_obj.id),
        class_name=class_obj.class_name,
        course_id=str(class_obj.course_id),
        course_name=course.course_name if course else "未知课程",
        course_code=course.course_code if course else "未知",
        teacher_name=teacher.full_name if teacher and teacher.full_name else (teacher.username if teacher else "未知教师"),
        academic_year=class_obj.academic_year or '',
        max_students=class_obj.max_students,
        current_students=current_count + 1,
        enrollment_date=datetime.utcnow().strftime("%Y-%m-%d")
    )

@router.get("/my-classes", response_model=List[ClassInfo])
async def get_my_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取学生已加入的班级列表"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    
    from sqlalchemy import text
    
    # 获取学生加入的所有班级
    class_students = db.execute(
        text("""
            SELECT class_id, enrollment_date 
            FROM class_students 
            WHERE student_id = :student_id AND status = 'active'
        """),
        {"student_id": str(current_user.id)}
    ).fetchall()
    
    result = []
    for cs in class_students:
        class_obj = db.query(Class).filter(Class.id == cs.class_id).first()
        if not class_obj:
            continue
            
        # 获取课程信息
        course = db.query(Course).filter(Course.id == class_obj.course_id).first()
        
        # 获取教师信息
        teacher = db.query(User).filter(User.id == class_obj.teacher_id).first()
        
        # 获取班级当前学生数
        current_count = db.execute(
            text("SELECT COUNT(*) FROM class_students WHERE class_id = :class_id AND status = 'active'"),
            {"class_id": str(class_obj.id)}
        ).scalar()
        
        result.append(ClassInfo(
            id=str(class_obj.id),
            class_name=class_obj.class_name,
            course_id=str(class_obj.course_id),
            course_name=course.course_name if course else "未知课程",
            course_code=course.course_code if course else "未知",
            teacher_name=teacher.full_name if teacher and teacher.full_name else (teacher.username if teacher else "未知教师"),
            academic_year=class_obj.academic_year or '',
            max_students=class_obj.max_students,
            current_students=current_count or 0,
            enrollment_date=cs.enrollment_date.strftime("%Y-%m-%d") if cs.enrollment_date else ""
        ))
    
    return result
