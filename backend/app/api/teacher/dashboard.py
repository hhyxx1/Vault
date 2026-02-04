from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.course import Course, Class
from app.utils.auth import get_current_user
from app.models.qa import QARecord
from app.models.survey import SurveyResponse, Answer
from app.models.user import Student as StudentModel

router = APIRouter()

# 模型定义

class DashboardData(BaseModel):
    totalStudents: int
    totalQuestions: int
    avgParticipationRate: float
    topStudents: List[Dict[str, Any]]
    questionTrend: List[Dict[str, Any]]
    categoryDistribution: List[Dict[str, Any]]

class Student(BaseModel):
    id: str
    name: str
    avatar: str
    grade: str
    class_name: str
    enrollmentDate: str

class StudentStats(BaseModel):
    studentId: str
    questionCount: int
    participationRate: float
    avgQuestionScore: float
    highFrequencyQuestions: List[str]
    lastActiveDate: str

class TableHeader(BaseModel):
    id: str
    title: str
    key: str
    visible: bool

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

@router.get("/", response_model=DashboardData)
async def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师仪表盘数据
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 计算总学生数
    total_students = db.query(User).filter(User.role == 'student').count()
    
    # 计算总提问数（从问答记录中）
    total_questions = db.query(QARecord).count()
    
    # 计算平均参与度（示例计算）
    avg_participation_rate = 0.75  # 示例值，实际应用中需要根据具体业务逻辑计算
    
    # 最活跃学生（示例数据）
    top_students = []
    
    # 提问趋势（示例数据）
    from datetime import datetime, timedelta
    question_trend = []
    for i in range(7):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        # 示例数据，实际应用中需要从数据库获取
        count = (7-i) * 5  # 递减的示例数据
        question_trend.append({"date": date, "count": count})
    question_trend.reverse()  # 让日期按升序排列
    
    # 问题分类分布（示例数据）
    category_distribution = [
        {"category": "编程基础", "count": 30},
        {"category": "算法", "count": 25},
        {"category": "数据库", "count": 15},
        {"category": "前端", "count": 20},
        {"category": "其他", "count": 10}
    ]
    
    return DashboardData(
        totalStudents=total_students,
        totalQuestions=total_questions,
        avgParticipationRate=avg_participation_rate,
        topStudents=top_students,
        questionTrend=question_trend,
        categoryDistribution=category_distribution
    )


@router.get("/students", response_model=List[Student])
async def get_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取学生列表
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 获取教师课程下的学生
    students = db.query(User, StudentModel).join(StudentModel, User.id == StudentModel.user_id).all()
    
    result = []
    for user, student in students:
        result.append(Student(
            id=str(user.id),
            name=user.full_name or user.username,
            avatar=user.avatar_url or "",
            grade=student.grade or "",
            class_name=student.class_name or "",
            enrollmentDate=student.created_at.strftime("%Y-%m-%d") if student.created_at else ""
        ))
    
    return result


@router.get("/student-stats", response_model=List[StudentStats])
async def get_student_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取学生统计数据
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 获取学生统计信息
    students = db.query(User, StudentModel).join(StudentModel, User.id == StudentModel.user_id).all()
    
    result = []
    for user, student in students:
        # 示例计算，实际应用中需要根据具体业务逻辑计算
        result.append(StudentStats(
            studentId=str(user.id),
            questionCount=student.total_questions,
            participationRate=0.75,  # 示例值
            avgQuestionScore=float(student.total_scores / student.total_questions) if student.total_questions > 0 else 0.0,
            highFrequencyQuestions=["常见问题1", "常见问题2"],  # 示例值
            lastActiveDate=student.updated_at.strftime("%Y-%m-%d") if student.updated_at else ""
        ))
    
    return result


@router.get("/table-headers", response_model=List[TableHeader])
async def get_table_headers(
    current_user: User = Depends(get_current_user)
):
    """
    获取表格表头配置
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 返回默认的表头配置
    headers = [
        TableHeader(id='name', title='姓名', key='name', visible=True),
        TableHeader(id='questionCount', title='提问数', key='questionCount', visible=True),
        TableHeader(id='participationRate', title='参与度', key='participationRate', visible=True),
        TableHeader(id='avgQuestionScore', title='平均分', key='avgQuestionScore', visible=True),
        TableHeader(id='lastActiveDate', title='最后活动', key='lastActiveDate', visible=True),
        TableHeader(id='highFrequencyQuestions', title='高频问题', key='highFrequencyQuestions', visible=False),
    ]
    
    return headers


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
