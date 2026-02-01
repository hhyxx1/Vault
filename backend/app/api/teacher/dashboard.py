from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.course import Course, Class
from app.utils.auth import get_current_user

router = APIRouter()

# 模型定义
class Stats(BaseModel):
    total_students: int
    active_questions: int
    surveys_completed: int
    average_score: float

class RecentQuestion(BaseModel):
    id: str
    student: str
    question: str
    time: str

class ClassResponse(BaseModel):
    id: str
    class_name: str
    course_name: str
    course_code: str
    academic_year: str
    invite_code: str
    allow_self_enroll: bool
    max_students: int
    current_students: int
    created_at: str
    
    class Config:
        from_attributes = True

class StudentInfo(BaseModel):
    id: str
    username: str
    full_name: Optional[str]
    email: Optional[str]
    student_id: Optional[str]
    enrollment_date: str
    
    class Config:
        from_attributes = True

class ClassDetailResponse(BaseModel):
    id: str
    class_name: str
    course_name: str
    course_code: str
    academic_year: str
    invite_code: str
    allow_self_enroll: bool
    max_students: int
    current_students: int
    students: List[StudentInfo]
    created_at: str
    
    class Config:
        from_attributes = True

@router.get("/stats", response_model=Stats)
async def get_stats():
    """
    获取教师看板统计数据
    """
    # TODO: 从数据库获取真实统计数据
    return Stats(
        total_students=128,
        active_questions=45,
        surveys_completed=95,
        average_score=85.5
    )

@router.get("/recent-questions", response_model=List[RecentQuestion])
async def get_recent_questions():
    """
    获取最近的学生提问
    """
    # TODO: 从数据库获取最近提问
    return [
        RecentQuestion(
            id="1",
            student="学生A",
            question="如何理解React的状态管理？",
            time="5分钟前"
        ),
        RecentQuestion(
            id="2",
            student="学生B",
            question="TypeScript的类型推断如何工作？",
            time="10分钟前"
        )
    ]

@router.get("/classes", response_model=List[ClassResponse])
async def get_teacher_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师的所有班级列表（包含邀请码和学生人数）
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 获取教师的所有班级
    classes = db.query(Class).filter(
        Class.teacher_id == current_user.id,
        Class.status == 'active'
    ).all()
    
    result = []
    for class_obj in classes:
        # 获取课程信息
        course = db.query(Course).filter(Course.id == class_obj.course_id).first()
        
        # 获取班级当前学生数
        current_count = db.execute(
            text("SELECT COUNT(*) FROM class_students WHERE class_id = :class_id AND status = 'active'"),
            {"class_id": str(class_obj.id)}
        ).scalar() or 0
        
        result.append(ClassResponse(
            id=str(class_obj.id),
            class_name=class_obj.class_name,
            course_name=course.course_name if course else "未知课程",
            course_code=course.course_code if course else "未知",
            academic_year=class_obj.academic_year or '',
            invite_code=class_obj.invite_code or '',
            allow_self_enroll=class_obj.allow_self_enroll,
            max_students=class_obj.max_students,
            current_students=current_count,
            created_at=class_obj.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ))
    
    return result

@router.get("/classes/{class_id}", response_model=ClassDetailResponse)
async def get_class_detail(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取班级详情（包含学生列表）
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 查找班级
    try:
        class_uuid = UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的班级ID")
    
    class_obj = db.query(Class).filter(
        Class.id == class_uuid,
        Class.teacher_id == current_user.id,
        Class.status == 'active'
    ).first()
    
    if not class_obj:
        raise HTTPException(status_code=404, detail="班级不存在或无权访问")
    
    # 获取课程信息
    course = db.query(Course).filter(Course.id == class_obj.course_id).first()
    
    # 获取班级学生列表
    students_data = db.execute(
        text("""
            SELECT u.id, u.username, u.full_name, u.email, u.student_id, cs.enrollment_date
            FROM class_students cs
            JOIN users u ON cs.student_id = u.id
            WHERE cs.class_id = :class_id AND cs.status = 'active'
            ORDER BY cs.enrollment_date DESC
        """),
        {"class_id": str(class_obj.id)}
    ).fetchall()
    
    students = []
    for student in students_data:
        students.append(StudentInfo(
            id=str(student.id),
            username=student.username,
            full_name=student.full_name,
            email=student.email,
            student_id=student.student_id,
            enrollment_date=student.enrollment_date.strftime("%Y-%m-%d") if student.enrollment_date else ""
        ))
    
    return ClassDetailResponse(
        id=str(class_obj.id),
        class_name=class_obj.class_name,
        course_name=course.course_name if course else "未知课程",
        course_code=course.course_code if course else "未知",
        academic_year=class_obj.academic_year or '',
        invite_code=class_obj.invite_code or '',
        allow_self_enroll=class_obj.allow_self_enroll,
        max_students=class_obj.max_students,
        current_students=len(students),
        students=students,
        created_at=class_obj.created_at.strftime("%Y-%m-%d %H:%M:%S")
    )
