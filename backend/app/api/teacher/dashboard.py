from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User
from app.models.course import Course, Class
from app.models.qa import QARecord
from app.models.survey import Survey, SurveyResponse
from app.utils.auth import get_current_user

router = APIRouter()

# 模型定义
class Stats(BaseModel):
    total_students: int
    total_questions: int
    avg_participation_rate: float
    active_students: int

class StudentStatsItem(BaseModel):
    student_id: str
    student_name: str
    question_count: int
    participation_rate: float
    avg_score: float
    last_active_date: Optional[str]

class QuestionTrendItem(BaseModel):
    date: str
    count: int

class CategoryDistributionItem(BaseModel):
    category: str
    count: int

class DashboardOverview(BaseModel):
    stats: Stats
    question_trend: List[QuestionTrendItem]
    category_distribution: List[CategoryDistributionItem]
    student_stats: List[StudentStatsItem]

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

@router.get("/overview", response_model=DashboardOverview)
async def get_dashboard_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师看板完整概览数据
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    try:
        print(f"\n{'='*50}")
        print(f"[Dashboard] 当前教师ID: {current_user.id}")
        print(f"[Dashboard] 用户名: {current_user.username}")
        
        # 先检查教师有多少班级
        teacher_classes = db.execute(text("""
            SELECT id, class_name, status FROM classes WHERE teacher_id = :teacher_id
        """), {"teacher_id": str(current_user.id)}).fetchall()
        print(f"[Dashboard] 教师的班级数量: {len(teacher_classes)}")
        for c in teacher_classes:
            print(f"  - 班级ID: {c.id}, 名称: {c.class_name}, 状态: {c.status}")
            # 检查每个班级的学生数
            student_count = db.execute(text("""
                SELECT COUNT(*) as cnt, cs.status 
                FROM class_students cs 
                WHERE cs.class_id = :class_id 
                GROUP BY cs.status
            """), {"class_id": str(c.id)}).fetchall()
            for sc in student_count:
                print(f"    学生数(状态={sc.status}): {sc.cnt}")
        
        # 检查所有班级（不分教师）
        all_classes = db.execute(text("SELECT id, class_name, teacher_id FROM classes LIMIT 5")).fetchall()
        print(f"[Dashboard] 数据库中的班级(前5个):")
        for ac in all_classes:
            print(f"  - {ac.class_name}, teacher_id: {ac.teacher_id}")
        
        # 1. 获取教师的所有班级的学生
        class_students = db.execute(text("""
            SELECT DISTINCT cs.student_id, u.full_name, u.username
            FROM classes c
            JOIN class_students cs ON c.id = cs.class_id
            JOIN users u ON cs.student_id = u.id
            WHERE c.teacher_id = :teacher_id 
            AND c.status = 'active' 
            AND cs.status = 'active'
        """), {"teacher_id": str(current_user.id)}).fetchall()
        
        student_map = {str(s.student_id): s.full_name or s.username for s in class_students}
        total_students = len(student_map)
        student_ids_list = list(student_map.keys())
        print(f"[Dashboard] 学生总数: {total_students}")
        if student_ids_list:
            print(f"[Dashboard] 学生列表: {list(student_map.values())}")
        
        # 2. 获取QA统计数据
        qa_stats = []
        if student_ids_list:
            # 使用 IN 查询代替 ANY (兼容性更好)
            # 动态构建参数
            placeholders = ", ".join([f":id_{i}" for i in range(len(student_ids_list))])
            params = {f"id_{i}": student_ids_list[i] for i in range(len(student_ids_list))}
            
            qa_stats = db.execute(text(f"""
                SELECT 
                    student_id,
                    COUNT(*) as question_count,
                    MAX(created_at) as last_active
                FROM qa_records
                WHERE student_id IN ({placeholders})
                AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY student_id
            """), params).fetchall()
            print(f"[Dashboard] QA统计: {len(qa_stats)}条记录")
        
        total_questions = sum(s.question_count for s in qa_stats)
        active_students = len([s for s in qa_stats if s.question_count > 0])
        
        # 3. 获取问卷统计
        survey_stats = db.execute(text("""
            SELECT 
                sr.student_id,
                COUNT(*) as survey_count,
                AVG(sr.percentage_score) as avg_score
            FROM survey_responses sr
            JOIN surveys s ON sr.survey_id = s.id
            WHERE s.teacher_id = :teacher_id
            AND sr.status = 'completed'
            GROUP BY sr.student_id
        """), {"teacher_id": str(current_user.id)}).fetchall()
        
        survey_map = {str(s.student_id): {
            'count': s.survey_count,
            'avg_score': float(s.avg_score) if s.avg_score else 0.0
        } for s in survey_stats}
        
        # 4. 计算参与率
        participation_rate = active_students / total_students if total_students > 0 else 0
        
        # 5. 准备学生统计数据
        student_stats = []
        for student_id, student_name in student_map.items():
            qa_data = next((s for s in qa_stats if str(s.student_id) == student_id), None)
            survey_data = survey_map.get(student_id, {'count': 0, 'avg_score': 0.0})
            
            question_count = qa_data.question_count if qa_data else 0
            last_active = qa_data.last_active.strftime("%Y-%m-%d") if qa_data and qa_data.last_active else None
            
            student_stats.append(StudentStatsItem(
                student_id=student_id,
                student_name=student_name,
                question_count=question_count,
                participation_rate=1.0 if question_count > 0 else 0.0,
                avg_score=survey_data['avg_score'],
                last_active_date=last_active
            ))
        
        # 6. 获取近7天的问题趋势
        question_trend = []
        for i in range(6, -1, -1):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            count = 0
            if student_ids_list:
                # 使用 IN 查询代替 ANY
                placeholders_trend = ", ".join([f":sid_{i}" for i in range(len(student_ids_list))])
                params_trend = {f"sid_{i}": student_ids_list[i] for i in range(len(student_ids_list))}
                params_trend["date"] = date
                
                count_result = db.execute(text(f"""
                    SELECT COUNT(*) as count
                    FROM qa_records
                    WHERE DATE(created_at) = :date
                    AND student_id IN ({placeholders_trend})
                """), params_trend).fetchone()
                count = count_result.count if count_result else 0
            
            question_trend.append(QuestionTrendItem(
                date=date,
                count=count
            ))
        
        # 7. 模拟分类分布（实际应该从问题标签或分类字段获取）
        category_distribution = [
            CategoryDistributionItem(category="课程相关", count=int(total_questions * 0.4)),
            CategoryDistributionItem(category="作业问题", count=int(total_questions * 0.3)),
            CategoryDistributionItem(category="考试相关", count=int(total_questions * 0.2)),
            CategoryDistributionItem(category="其他", count=int(total_questions * 0.1)),
        ]
        
        return DashboardOverview(
            stats=Stats(
                total_students=total_students,
                total_questions=total_questions,
                avg_participation_rate=participation_rate,
                active_students=active_students
            ),
            question_trend=question_trend,
            category_distribution=category_distribution,
            student_stats=student_stats
        )
        
    except Exception as e:
        print(f"获取看板数据失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取看板数据失败: {str(e)}")

@router.get("/stats", response_model=Stats)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师看板统计数据
    """
    overview = await get_dashboard_overview(current_user, db)
    return overview.stats

@router.get("/recent-questions", response_model=List[RecentQuestion])
async def get_recent_questions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取最近的学生提问（从教师班级的学生中获取）
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    try:
        # 获取教师班级中学生的最近提问
        recent_questions = db.execute(text("""
            SELECT 
                q.id,
                u.full_name,
                u.username,
                q.question,
                q.created_at
            FROM qa_records q
            JOIN users u ON q.student_id = u.id
            WHERE q.student_id IN (
                SELECT DISTINCT cs.student_id
                FROM classes c
                JOIN class_students cs ON c.id = cs.class_id
                WHERE c.teacher_id = :teacher_id
                AND c.status = 'active'
                AND cs.status = 'active'
            )
            ORDER BY q.created_at DESC
            LIMIT 10
        """), {"teacher_id": str(current_user.id)}).fetchall()
        
        result = []
        now = datetime.now()
        for q in recent_questions:
            # 计算时间差
            time_diff = now - q.created_at
            if time_diff.days > 0:
                time_str = f"{time_diff.days}天前"
            elif time_diff.seconds >= 3600:
                time_str = f"{time_diff.seconds // 3600}小时前"
            elif time_diff.seconds >= 60:
                time_str = f"{time_diff.seconds // 60}分钟前"
            else:
                time_str = "刚刚"
            
            result.append(RecentQuestion(
                id=str(q.id),
                student=q.full_name or q.username,
                question=q.question[:100] + "..." if len(q.question) > 100 else q.question,
                time=time_str
            ))
        
        return result
    except Exception as e:
        print(f"获取最近提问失败: {e}")
        import traceback
        traceback.print_exc()
        return []

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
