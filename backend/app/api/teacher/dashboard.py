from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
import asyncio

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


# 自定义卡片相关
class CustomCardRequest(BaseModel):
    question: str

class CustomCardResponse(BaseModel):
    id: str
    question: str
    answer: str
    status: str = 'completed'  # analyzing, completed, failed
    created_at: str


def _strip_markdown(text_content: str) -> str:
    """去除AI生成文本中的Markdown格式符号"""
    import re
    # 去除粗体 **text** 或 __text__
    text_content = re.sub(r'\*\*(.+?)\*\*', r'\1', text_content)
    text_content = re.sub(r'__(.+?)__', r'\1', text_content)
    # 去除斜体 *text* 或 _text_
    text_content = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'\1', text_content)
    # 去除标题标记 ### text
    text_content = re.sub(r'^#{1,6}\s+', '', text_content, flags=re.MULTILINE)
    # 去除行内代码 `code`
    text_content = re.sub(r'`(.+?)`', r'\1', text_content)
    # 去除列表标记但保留文本
    text_content = re.sub(r'^\s*[-*+]\s+', '• ', text_content, flags=re.MULTILINE)
    # 去除数字列表标记
    text_content = re.sub(r'^\s*\d+\.\s+', '', text_content, flags=re.MULTILINE)
    return text_content.strip()


def _run_ai_analysis_sync(card_id: str, teacher_id: str, question: str, db_url: str):
    """在后台线程中运行AI分析并更新卡片（同步版本）"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import os
    os.environ['PGCLIENTENCODING'] = 'UTF8'
    
    engine = create_engine(db_url, connect_args={'client_encoding': 'utf8', 'options': '-c client_encoding=utf8'})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # 获取教师的班级
        classes_result = db.execute(
            text("SELECT id FROM classes WHERE teacher_id = :tid"),
            {"tid": teacher_id}
        ).fetchall()
        class_ids = [str(r[0]) for r in classes_result]
        
        if not class_ids:
            db.execute(
                text("UPDATE teacher_insight_cards SET answer = :answer, status = 'completed', updated_at = NOW() WHERE id = CAST(:cid AS uuid)"),
                {"answer": "暂无班级数据，请先创建班级并邀请学生加入", "cid": card_id}
            )
            db.commit()
            return
        
        # 通过问卷获取学生ID
        result = db.execute(
            text("""
                SELECT DISTINCT sr.student_id 
                FROM survey_responses sr
                JOIN surveys s ON sr.survey_id = s.id
                WHERE s.teacher_id = :teacher_id
            """),
            {"teacher_id": teacher_id}
        )
        student_ids = [str(row[0]) for row in result]
        
        if not student_ids:
            db.execute(
                text("UPDATE teacher_insight_cards SET answer = :answer, status = 'completed', updated_at = NOW() WHERE id = CAST(:cid AS uuid)"),
                {"answer": "暂无学生提交数据，学生提交问卷后即可使用智能分析", "cid": card_id}
            )
            db.commit()
            return
        
        # 获取学生信息
        placeholders = ", ".join([f":sid_{i}" for i in range(len(student_ids))])
        params = {f"sid_{i}": student_ids[i] for i in range(len(student_ids))}
        students = db.execute(
            text(f"SELECT id, full_name, username FROM users WHERE id IN ({placeholders}) AND role = 'student'"),
            params
        ).fetchall()
        
        # 获取QA记录
        qa_records = db.execute(
            text(f"SELECT student_id, question, knowledge_sources FROM qa_records WHERE student_id IN ({placeholders})"),
            params
        ).fetchall()
        
        # 获取问卷成绩
        survey_responses = db.execute(
            text(f"SELECT student_id, percentage_score FROM survey_responses WHERE student_id IN ({placeholders}) AND status = 'completed'"),
            params
        ).fetchall()
        
        # 构建学生数据摘要
        student_data = []
        for student in students:
            s_id = str(student[0])
            s_name = student[1] or student[2]
            s_qa = [q for q in qa_records if str(q[0]) == s_id]
            s_surveys = [sr for sr in survey_responses if str(sr[0]) == s_id]
            
            avg_score = sum(float(sr[1] or 0) for sr in s_surveys) / len(s_surveys) if s_surveys else 0
            
            topics = {}
            for qa in s_qa[:20]:
                if qa[2] and isinstance(qa[2], list):
                    for source in qa[2]:
                        if isinstance(source, dict) and 'title' in source:
                            topic = source['title']
                            topics[topic] = topics.get(topic, 0) + 1
            
            student_data.append({
                "name": s_name,
                "question_count": len(s_qa),
                "avg_score": avg_score,
                "topics": topics
            })
        
        # 构建AI提示词
        data_summary = f"班级总人数: {len(students)}\n\n"
        data_summary += "学生数据摘要:\n"
        for i, s in enumerate(student_data[:10], 1):
            data_summary += f"{i}. {s['name']}: 提问{s['question_count']}次, 平均成绩{s['avg_score']:.1f}%, "
            if s['topics']:
                top_topics = sorted(s['topics'].items(), key=lambda x: x[1], reverse=True)[:3]
                data_summary += f"关注话题: {', '.join([f'{t[0]}({t[1]}次)' for t in top_topics])}"
            data_summary += "\n"
        
        prompt = f"""你是一个教学数据分析助手。基于以下班级数据，回答教师的问题。

{data_summary}

教师问题: {question}

请给出简洁、有洞察力的回答（150字以内），如果问题涉及具体学生，请列出学生姓名和相关数据。
注意：回答中不要使用任何Markdown格式，不要使用**加粗**、# 标题、- 列表等标记符号，只使用纯文本。"""

        # 调用AI
        answer = None
        try:
            from app.services.ai_service import ai_service
            import httpx
            
            # 同步调用: 使用sync client
            response = ai_service.client.chat.completions.create(
                model=ai_service.model_name,
                messages=[
                    {'role': 'system', 'content': '你是一个专业的教学数据分析助手，善于从数据中发现洞察。回答时只使用纯文本，不要使用Markdown格式。'},
                    {'role': 'user', 'content': prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            answer = response.choices[0].message.content
        except Exception as e:
            print(f"AI分析失败: {e}")
            # 规则回退
            if "活跃" in question or "最多" in question:
                top = sorted(student_data, key=lambda x: x['question_count'], reverse=True)[:5]
                answer = "最活跃的学生（按提问数）:\n" + "\n".join([
                    f"{i+1}. {s['name']}: {s['question_count']}次提问"
                    for i, s in enumerate(top)
                ])
            elif "成绩" in question:
                top = sorted([s for s in student_data if s['avg_score'] > 0],
                            key=lambda x: x['avg_score'], reverse=True)[:5]
                answer = "成绩最好的学生:\n" + "\n".join([
                    f"{i+1}. {s['name']}: 平均{s['avg_score']:.1f}%"
                    for i, s in enumerate(top)
                ])
            else:
                answer = f"共有{len(students)}名学生，总计{len(qa_records)}次提问。建议更具体地描述您的问题。"
        
        # 清理markdown格式
        answer = _strip_markdown(answer)
        
        db.execute(
            text("UPDATE teacher_insight_cards SET answer = :answer, status = 'completed', updated_at = NOW() WHERE id = CAST(:cid AS uuid)"),
            {"answer": answer, "cid": card_id}
        )
        db.commit()
        
    except Exception as e:
        print(f"后台AI分析失败: {e}")
        import traceback
        traceback.print_exc()
        try:
            db.execute(
                text("UPDATE teacher_insight_cards SET answer = :answer, status = 'failed', updated_at = NOW() WHERE id = CAST(:cid AS uuid)"),
                {"answer": f"分析失败: {str(e)[:100]}", "cid": card_id}
            )
            db.commit()
        except:
            pass
    finally:
        db.close()
        engine.dispose()


@router.get("/custom-insights", response_model=List[CustomCardResponse])
async def get_custom_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师的所有自定义洞察卡片
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    rows = db.execute(
        text("SELECT id, question, answer, status, created_at FROM teacher_insight_cards WHERE teacher_id = :tid ORDER BY created_at DESC"),
        {"tid": str(current_user.id)}
    ).fetchall()
    
    return [
        CustomCardResponse(
            id=str(r[0]),
            question=r[1],
            answer=r[2] or '',
            status=r[3],
            created_at=r[4].strftime("%Y-%m-%d %H:%M:%S") if r[4] else ''
        ) for r in rows
    ]


@router.get("/custom-insight/{card_id}", response_model=CustomCardResponse)
async def get_custom_insight(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取单个洞察卡片（用于轮询状态）
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    row = db.execute(
        text("SELECT id, question, answer, status, created_at FROM teacher_insight_cards WHERE id = CAST(:cid AS uuid) AND teacher_id = :tid"),
        {"cid": card_id, "tid": str(current_user.id)}
    ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="卡片不存在")
    
    return CustomCardResponse(
        id=str(row[0]),
        question=row[1],
        answer=row[2] or '',
        status=row[3],
        created_at=row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else ''
    )


@router.delete("/custom-insight/{card_id}")
async def delete_custom_insight(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除洞察卡片
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    result = db.execute(
        text("DELETE FROM teacher_insight_cards WHERE id = CAST(:cid AS uuid) AND teacher_id = :tid"),
        {"cid": card_id, "tid": str(current_user.id)}
    )
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="卡片不存在")
    
    return {"message": "删除成功"}


@router.post("/custom-insight/{card_id}/refresh", response_model=CustomCardResponse)
async def refresh_custom_insight(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    刷新洞察卡片：基于最新学生数据重新分析
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")

    row = db.execute(
        text("SELECT id, question, created_at FROM teacher_insight_cards WHERE id = CAST(:cid AS uuid) AND teacher_id = :tid"),
        {"cid": card_id, "tid": str(current_user.id)}
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="卡片不存在")

    # 先将卡片状态置为 analyzing，清空旧答案
    db.execute(
        text("UPDATE teacher_insight_cards SET answer = '', status = 'analyzing', updated_at = NOW() WHERE id = CAST(:cid AS uuid) AND teacher_id = :tid"),
        {"cid": card_id, "tid": str(current_user.id)}
    )
    db.commit()

    # 后台线程重新分析
    from app.config.settings import settings
    import threading
    thread = threading.Thread(
        target=_run_ai_analysis_sync,
        args=(str(row[0]), str(current_user.id), row[1], settings.DATABASE_URL),
        daemon=True
    )
    thread.start()

    return CustomCardResponse(
        id=str(row[0]),
        question=row[1],
        answer='',
        status='analyzing',
        created_at=row[2].strftime("%Y-%m-%d %H:%M:%S") if row[2] else ''
    )


@router.post("/custom-insight", response_model=CustomCardResponse)
async def create_custom_insight(
    request: CustomCardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建自定义洞察卡片
    立即保存到数据库并返回，AI分析在后台线程中进行
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    try:
        import uuid as uuid_mod
        
        card_id = str(uuid_mod.uuid4())
        now = datetime.now()
        
        # 立即保存到数据库，status='analyzing'
        db.execute(
            text("""
                INSERT INTO teacher_insight_cards (id, teacher_id, question, answer, status, created_at, updated_at)
                VALUES (CAST(:id AS uuid), CAST(:tid AS uuid), :question, '', 'analyzing', :now, :now)
            """),
            {"id": card_id, "tid": str(current_user.id), "question": request.question, "now": now}
        )
        db.commit()
        
        # 在后台线程运行AI分析
        from app.config.settings import settings
        import threading
        thread = threading.Thread(
            target=_run_ai_analysis_sync,
            args=(card_id, str(current_user.id), request.question, settings.DATABASE_URL),
            daemon=True
        )
        thread.start()
        
        # 立即返回卡片（状态为analyzing）
        return CustomCardResponse(
            id=card_id,
            question=request.question,
            answer='',
            status='analyzing',
            created_at=now.strftime("%Y-%m-%d %H:%M:%S")
        )
        
    except Exception as e:
        print(f"创建自定义卡片失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

