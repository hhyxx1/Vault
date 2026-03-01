from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
import json
import asyncio
from uuid import UUID

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.survey import Survey as SurveyModel, Question as QuestionModel, SurveyResponse as SurveyResponseModel, Answer as AnswerModel
from app.utils.auth import get_current_user

router = APIRouter()

# Pydantic响应模型定义
class QuestionResponse(BaseModel):
    id: str
    text: str
    type: str
    options: List[str] | None = None
    required: bool = True

class SurveyResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    status: str
    questions: List[QuestionResponse]

class SurveySubmission(BaseModel):
    answers: Dict[str, Any]


def _get_student_class_ids(db: Session, student_id: str) -> List[str]:
    """获取学生已加入的班级ID列表"""
    try:
        rows = db.execute(
            text("""
                SELECT class_id FROM class_students
                WHERE student_id = :student_id AND status = 'active'
            """),
            {"student_id": str(student_id)}
        ).fetchall()
        return [str(r.class_id) for r in rows] if rows else []
    except Exception as e:
        print(f"学生班级查询失败 student_id={student_id}: {e}")
        return []


@router.get("")
async def get_surveys(
    release_type: Optional[str] = Query(None, description="发布类型: in_class=课堂检测, homework=课后作业, practice=自主练习"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取学生可用的已发布问卷列表。
    仅返回：1) 已发布 2) 发布到当前学生所在班级 3) 可选按发布类型筛选。
    """
    try:
        if getattr(current_user, "role", None) != "student":
            raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
        student_id = str(current_user.id)
        class_ids = _get_student_class_ids(db, student_id)
        if not class_ids:
            return []
        # 兼容：若表尚无 release_type/target_class_ids 列（未执行迁移），避免 500，返回空列表
        surveys = []
        try:
            query = db.query(SurveyModel).filter(SurveyModel.status == "published")
            if release_type:
                query = query.filter(SurveyModel.release_type == release_type)
            surveys = query.order_by(SurveyModel.published_at.desc()).all()
        except (ProgrammingError, Exception) as e:
            # 打印完整异常信息用于调试
            print(f"学生问卷列表查询异常: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            err_msg = str(e).lower()
            if "release_type" in err_msg or "target_class_ids" in err_msg or "column" in err_msg:
                print("学生问卷列表: 检测到表结构未迁移(release_type/target_class_ids)，请执行 backend/database/migrate_survey_release.sql")
                return []
            raise
        result = []
        for survey in surveys:
            target_ids = getattr(survey, "target_class_ids", None) or []
            legacy_class_id = getattr(survey, "class_id", None)
            visible = False
            if target_ids:
                visible = any(str(cid) in class_ids for cid in (target_ids if isinstance(target_ids, list) else []))
            elif legacy_class_id:
                visible = str(legacy_class_id) in class_ids
            if not visible:
                continue
            
            question_count = db.query(QuestionModel).filter(QuestionModel.survey_id == survey.id).count()
            
            # 时间状态判断
            start_time = getattr(survey, "start_time", None)
            end_time = getattr(survey, "end_time", None)
            time_status = "available"  # available, upcoming, ended
            
            from datetime import datetime
            now = datetime.now()
            if start_time and now < start_time:
                time_status = "upcoming"
            elif end_time and now > end_time:
                time_status = "ended"
            
            result.append({
                "id": str(survey.id),
                "title": survey.title,
                "description": survey.description or "",
                "questionCount": question_count,
                "status": "published",
                "releaseType": getattr(survey, "release_type", None) or "in_class",
                "publishedAt": survey.published_at.strftime("%Y-%m-%d") if survey.published_at else None,
                "dueDate": end_time.strftime("%Y-%m-%d") if end_time else None,
                "startTime": start_time.isoformat() if start_time else None,
                "endTime": end_time.isoformat() if end_time else None,
                "timeStatus": time_status,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"学生问卷列表异常: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取问卷列表失败: {str(e)}")


@router.get("/{survey_id}", response_model=SurveyResponse)
async def get_survey_detail(
    survey_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取问卷详情（仅已发布且对当前学生可见的问卷）
    根据时间状态决定是否允许访问
    """
    if getattr(current_user, "role", None) != "student":
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    survey = db.query(SurveyModel).filter(SurveyModel.id == survey_id).first()
    if not survey or survey.status != "published":
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    
    # 检查时间状态
    from datetime import datetime
    start_time = getattr(survey, "start_time", None)
    end_time = getattr(survey, "end_time", None)
    now = datetime.now()
    
    if start_time and now < start_time:
        # 计算倒计时
        time_diff = int((start_time - now).total_seconds())
        raise HTTPException(status_code=403, detail={
            "type": "upcoming",
            "startTime": start_time.isoformat(),
            "countdown": time_diff
        })
    
    if end_time and now > end_time:
        raise HTTPException(status_code=403, detail={
            "type": "ended",
            "endTime": end_time.isoformat()
        })
    
    class_ids = _get_student_class_ids(db, str(current_user.id))
    target_ids = getattr(survey, "target_class_ids", None) or []
    legacy_class_id = getattr(survey, "class_id", None)
    visible = (target_ids and any(cid in class_ids for cid in (target_ids if isinstance(target_ids, list) else []))) or (
        legacy_class_id and str(legacy_class_id) in class_ids
    )
    if not visible:
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    
    # 使用 survey.id (UUID类型) 而不是 survey_id (字符串)
    from uuid import UUID as PyUUID
    try:
        survey_uuid = survey.id if hasattr(survey.id, 'hex') else PyUUID(str(survey_id))
    except:
        survey_uuid = survey_id
    
    questions = db.query(QuestionModel).filter(QuestionModel.survey_id == survey_uuid).order_by(QuestionModel.question_order).all()
    print(f"[DEBUG] 问卷详情查询 survey_id={survey_id}, survey.id={survey.id}, 找到题目数量: {len(questions)}")
    
    def normalize_options(options, question_type=None):
        """格式化选项，将选项转换为带 A、B、C、D 前缀的字符串格式"""
        if not options:
            return None
        
        # 判断题特殊处理
        if question_type in ['judge', 'judgment', 'true_false']:
            return ['A. 正确', 'B. 错误']
        
        option_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        
        if isinstance(options, list):
            normalized = []
            for idx, opt in enumerate(options):
                letter = option_letters[idx] if idx < len(option_letters) else str(idx)
                
                if isinstance(opt, dict):
                    # 支持多种字典格式：
                    # {'key': 'A', 'value': 'xxx'} 或 {'text': 'xxx', 'label': 'A'} 或 {'content': 'xxx'}
                    key = opt.get('key') or opt.get('label') or ''
                    value = opt.get('value') or opt.get('text') or opt.get('content') or ''
                    
                    # 如果已有有效的 key（A/B/C/D），使用它
                    if key and str(key).upper() in option_letters:
                        normalized.append(f"{str(key).upper()}. {value}")
                    elif value:
                        normalized.append(f"{letter}. {value}")
                    else:
                        # 如果都没有，尝试直接转换
                        normalized.append(f"{letter}. {str(opt)}")
                elif isinstance(opt, str):
                    # 检查是否已有选项标识
                    if len(opt) >= 2 and opt[0].upper() in option_letters and opt[1] in '.、':
                        normalized.append(opt)
                    elif '. ' in opt and opt.split('. ')[0].upper() in option_letters:
                        normalized.append(opt)
                    else:
                        normalized.append(f"{letter}. {opt}")
                else:
                    normalized.append(f"{letter}. {str(opt)}")
            return normalized
        return options
    
    return SurveyResponse(
        id=str(survey.id),
        title=survey.title,
        description=survey.description or "",
        status=survey.status,
        questions=[
            QuestionResponse(
                id=str(q.id),
                text=q.question_text,
                type=q.question_type,
                options=normalize_options(q.options, q.question_type),
                required=q.is_required,
            )
            for q in questions
        ]
    )


@router.get("/{survey_id}/my-result")
async def get_my_result(
    survey_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取当前学生在该问卷下的作答状态与成绩。
    用于「查看详情」：已提交且成绩已公布，可显示分数和完整答题情况；否则显示「等待老师公布成绩」。
    包含详细的答题情况、题目信息和AI评分反馈。
    """
    if getattr(current_user, "role", None) != "student":
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    from uuid import UUID
    try:
        sid = current_user.id if hasattr(current_user.id, 'hex') else UUID(str(current_user.id))
    except Exception:
        sid = UUID(str(current_user.id))
    response = (
        db.query(SurveyResponseModel)
        .filter(
            SurveyResponseModel.survey_id == survey_id,
            SurveyResponseModel.student_id == sid,
        )
        .order_by(SurveyResponseModel.attempt_number.desc())
        .first()
    )
    if not response:
        return {"submitted": False}
    
    # 获取问卷信息，检查成绩是否已发布
    survey = db.query(SurveyModel).filter(SurveyModel.id == survey_id).first()
    
    submitted = response.submit_time is not None
    # 检查教师是否已发布成绩
    score_published = getattr(survey, 'score_published', False) if survey else False
    
    # 获取所有题目信息
    questions = db.query(QuestionModel).filter(
        QuestionModel.survey_id == survey_id
    ).order_by(QuestionModel.question_order).all()
    
    # 获取详细答案和AI打分结果
    answers = db.query(AnswerModel).filter(
        AnswerModel.response_id == response.id
    ).all()
    
    # 构建答案映射，方便快速查找
    answer_map = {str(ans.question_id): ans for ans in answers}
    
    # 构建题目映射，用于转换答案显示格式
    question_map = {str(q.id): q for q in questions}
    
    # 辅助函数：将选项字母转换为可读文本
    def format_student_answer(student_answer, question):
        """将学生答案（如'A'）转换为可读格式（如'A. 选项内容'）"""
        if not student_answer or not question:
            return student_answer
        
        question_type = question.question_type
        options = question.options
        
        # 如果不是选择题，直接返回原答案
        if question_type not in ['single_choice', 'choice', 'multiple_choice', 'multi_choice', 'judge', 'judgment', 'true_false']:
            return student_answer
        
        if not options:
            return student_answer
        
        # 处理判断题
        if question_type in ['judge', 'judgment', 'true_false']:
            if str(student_answer).upper() == 'A':
                return 'A. 正确'
            elif str(student_answer).upper() == 'B':
                return 'B. 错误'
            return student_answer
        
        # 构建选项映射 {'A': '选项内容', 'B': '...'}
        option_map = {}
        option_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        
        if isinstance(options, list):
            for idx, opt in enumerate(options):
                letter = option_letters[idx] if idx < len(option_letters) else str(idx)
                
                if isinstance(opt, dict):
                    key = opt.get('key') or opt.get('label') or ''
                    value = opt.get('value') or opt.get('text') or opt.get('content') or ''
                    if key and str(key).upper() in option_letters:
                        option_map[str(key).upper()] = value
                    elif value:
                        option_map[letter] = value
                elif isinstance(opt, str):
                    # 字符串格式如 "A. xxx"
                    if len(opt) >= 2 and opt[0].upper() in option_letters and opt[1] in '.、':
                        option_map[opt[0].upper()] = opt[2:].strip()
                    elif '. ' in opt and opt.split('. ')[0].upper() in option_letters:
                        key, value = opt.split('. ', 1)
                        option_map[key.strip().upper()] = value.strip()
                    else:
                        option_map[letter] = opt
        
        # 处理多选题（答案是列表）
        if isinstance(student_answer, list):
            formatted = []
            for ans in student_answer:
                ans_upper = str(ans).upper().strip()
                if '.' in ans_upper:
                    ans_upper = ans_upper.split('.')[0].strip()
                if ans_upper in option_map:
                    formatted.append(f"{ans_upper}. {option_map[ans_upper]}")
                else:
                    formatted.append(ans)
            return formatted
        
        # 处理单选题
        ans_str = str(student_answer).strip()
        # 提取字母部分
        if '.' in ans_str:
            ans_str = ans_str.split('.')[0].strip()
        ans_upper = ans_str.upper()
        
        if ans_upper in option_map:
            return f"{ans_upper}. {option_map[ans_upper]}"
        
        return student_answer
    
    detailed_answers = []
    for ans in answers:
        question = question_map.get(str(ans.question_id))
        
        answer_data = {
            "questionId": str(ans.question_id),
            "studentAnswer": format_student_answer(ans.student_answer, question),
        }
        
        # 只有成绩发布后才显示分数和正确性
        if score_published:
            answer_data["isCorrect"] = ans.is_correct
            answer_data["score"] = float(ans.score) if ans.score is not None else None
            
            # 如果有AI打分结果，解析teacher_comment
            if ans.teacher_comment:
                try:
                    grading_result = json.loads(ans.teacher_comment)
                    answer_data["gradingResult"] = grading_result
                except:
                    pass
        
        detailed_answers.append(answer_data)
    
    # 构建题目详情列表
    def format_options(opts, q_type):
        """格式化选项为前端期望的 {key, value} 格式，使用 A、B、C、D 作为选项标识"""
        if not opts:
            return None
        
        # 判断题特殊处理
        if q_type in ['judge', 'judgment', 'true_false']:
            return [{"key": "A", "value": "正确"}, {"key": "B", "value": "错误"}]
        
        # 选项字母映射
        option_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        
        result_opts = []
        if isinstance(opts, list):
            for idx, opt in enumerate(opts):
                letter = option_letters[idx] if idx < len(option_letters) else str(idx)
                
                if isinstance(opt, dict):
                    # 支持多种字典格式
                    key = opt.get('key') or opt.get('label') or ''
                    value = opt.get('value') or opt.get('text') or opt.get('content') or ''
                    
                    if key and str(key).upper() in option_letters:
                        result_opts.append({"key": str(key).upper(), "value": value})
                    elif value:
                        result_opts.append({"key": letter, "value": value})
                    else:
                        result_opts.append({"key": letter, "value": str(opt)})
                elif isinstance(opt, str):
                    # 字符串格式，检查是否已有选项标识如 "A. xxx"
                    if len(opt) >= 2 and opt[0].upper() in option_letters and opt[1] in '.、':
                        key = opt[0].upper()
                        value = opt[2:].strip()
                        result_opts.append({"key": key, "value": value})
                    elif '. ' in opt and opt.split('. ')[0].upper() in option_letters:
                        key, value = opt.split('. ', 1)
                        result_opts.append({"key": key.strip().upper(), "value": value.strip()})
                    else:
                        # 没有选项标识，使用字母作为 key
                        result_opts.append({"key": letter, "value": opt})
                else:
                    result_opts.append({"key": letter, "value": str(opt)})
        
        return result_opts if result_opts else None
    
    questions_data = []
    for q in questions:
        q_data = {
            "id": str(q.id),
            "questionType": q.question_type,
            "questionText": q.question_text,
            "options": format_options(q.options, q.question_type),
            "score": float(q.score) if q.score is not None else 0,
            "knowledgePoints": q.knowledge_points if hasattr(q, 'knowledge_points') and q.knowledge_points else [],
        }
        
        # 只有成绩发布后才返回正确答案和解析
        if score_published:
            q_data["correctAnswer"] = q.correct_answer
            q_data["answerExplanation"] = q.answer_explanation if hasattr(q, 'answer_explanation') else None
        
        questions_data.append(q_data)
    
    result = {
        "submitted": submitted,
        "scorePublished": score_published,
        "submitTime": response.submit_time.isoformat() if response.submit_time else None,
        "answers": detailed_answers,
        # 返回完整的问卷信息
        "survey": {
            "id": str(survey.id),
            "title": survey.title,
            "description": survey.description or "",
            "totalScore": float(survey.total_score) if survey.total_score else 100,
            "passScore": float(survey.total_score) * 0.6 if survey.total_score else 60,
            "questions": questions_data
        }
    }
    
    # 只有成绩发布后才返回分数信息
    if score_published:
        result["totalScore"] = float(response.total_score) if response.total_score is not None else None
        result["percentageScore"] = float(response.percentage_score) if response.percentage_score is not None else None
        result["isPassed"] = response.is_passed
    
    return result


@router.post("/{survey_id}/submit")
async def submit_survey(
    survey_id: str,
    submission: SurveySubmission,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    提交问卷答案。会立即返回成功响应，然后后台异步打分。
    包含自动打分功能：选择题、判断题、填空题自动判分，问答题使用AI打分。
    """
    print(f"=" * 70)
    print(f"📝 学生提交问卷 - 开始")
    print(f"问卷ID: {survey_id}")
    print(f"学生ID: {current_user.id}")
    print(f"学生角色: {getattr(current_user, 'role', None)}")
    print(f"提交答案数量: {len(submission.answers) if submission.answers else 0}")
    print(f"=" * 70)
    
    if getattr(current_user, "role", None) != "student":
        print(f"❌ 权限验证失败：用户角色不是学生")
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    
    print(f"✅ 权限验证通过")
    
    survey = db.query(SurveyModel).filter(SurveyModel.id == survey_id).first()
    if not survey or survey.status != "published":
        print(f"❌ 问卷验证失败：问卷不存在或未发布")
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    
    print(f"✅ 问卷验证通过: {survey.title}")
    
    class_ids = _get_student_class_ids(db, str(current_user.id))
    print(f"📚 学生所在班级: {class_ids}")
    
    target_ids = getattr(survey, "target_class_ids", None) or []
    legacy_class_id = getattr(survey, "class_id", None)
    visible = (target_ids and any(str(cid) in class_ids for cid in (target_ids if isinstance(target_ids, list) else []))) or (
        legacy_class_id and str(legacy_class_id) in class_ids
    )
    if not visible:
        print(f"❌ 班级权限验证失败：学生不在目标班级中")
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    
    print(f"✅ 班级权限验证通过")
    
    from datetime import datetime
    from uuid import UUID
    try:
        sid = current_user.id if hasattr(current_user.id, 'hex') else UUID(str(current_user.id))
    except Exception:
        sid = UUID(str(current_user.id))
    
    existing = (
        db.query(SurveyResponseModel)
        .filter(
            SurveyResponseModel.survey_id == survey_id,
            SurveyResponseModel.student_id == sid,
        )
        .order_by(SurveyResponseModel.attempt_number.desc())
        .first()
    )
    
    print(f"📊 已有提交记录: {'是' if existing else '否'}")
    
    # 检查是否允许多次作答
    if not survey.allow_multiple_attempts:
        if existing:
            print(f"❌ 多次提交检查失败：不允许多次作答")
            raise HTTPException(
                status_code=400,
                detail="该问卷不允许多次作答，您已经提交过了"
            )
    else:
        existing_attempts = db.query(SurveyResponseModel).filter(
            SurveyResponseModel.survey_id == survey_id,
            SurveyResponseModel.student_id == sid,
        ).count()
        if existing_attempts >= survey.max_attempts:
            print(f"❌ 多次提交检查失败：已达到最大作答次数")
            raise HTTPException(
                status_code=400,
                detail=f"您已达到最大作答次数（{survey.max_attempts}次）"
            )
    
    print(f"✅ 多次提交检查通过")
    
    attempt = (existing.attempt_number + 1) if existing else 1
    
    # 立即创建提交记录，状态为"grading"（评分中）
    resp = SurveyResponseModel(
        survey_id=UUID(survey_id),
        student_id=sid,
        attempt_number=attempt,
        status="grading",  # 先标记为评分中
        submit_time=datetime.utcnow(),
    )
    db.add(resp)
    db.flush()
    
    response_id = resp.id
    print(f"✅ 创建提交记录: response_id={response_id}, attempt_number={attempt}, status=grading")
    
    # 保存原始答案（不打分）
    answers = submission.answers or {}
    for qid, ans in answers.items():
        try:
            a = AnswerModel(
                response_id=response_id,
                question_id=UUID(qid),
                student_answer=ans,
                is_correct=False,  # 暂时标记为False
                score=0,  # 暂时为0
                auto_graded=False,  # 标记为未打分
            )
            db.add(a)
        except Exception as e:
            print(f"⚠️ 保存答案失败: question_id={qid}, error={e}")
    
    db.commit()
    
    print(f"✅ 答案保存成功，立即返回响应")
    print(f"🔄 后台开始异步打分...")
    
    # 使用BackgroundTasks添加后台任务，确保任务在响应返回后继续执行
    # 即使用户关闭页面或导航到其他页面，打分任务仍会完成
    background_tasks.add_task(grade_survey_async, str(response_id), str(survey_id), answers)
    
    print(f"=" * 70)
    print(f"🎉 问卷提交成功（打分中）")
    print(f"=" * 70)
    
    # 立即返回成功响应
    return {
        "message": "问卷提交成功，正在后台评分",
        "survey_id": survey_id,
        "response_id": str(response_id),
        "status": "grading"
    }
    
    answers = submission.answers or {}
    total_score = 0
    answer_count = 0
    
    # 导入AI打分服务
    from app.services.essay_grading_service import essay_grading_service
    
    for qid, ans in answers.items():
        question = db.query(QuestionModel).filter(
            QuestionModel.id == UUID(qid)
        ).first()
        
        if not question:
            print(f"⚠️ 题目不存在: question_id={qid}")
            continue
        
        is_correct = False
        score = 0
        teacher_comment = None
        
        # 根据题目类型进行自动判分
        if question.question_type in ['single_choice', 'judgment']:
            correct_answer = question.correct_answer
            if correct_answer:
                if isinstance(correct_answer, list):
                    is_correct = ans in correct_answer
                else:
                    student_answer = str(ans).strip()
                    correct_answer_str = str(correct_answer).strip()
                    # 处理带选项号的答案 (如 "A. 选项内容")
                    if '.' in student_answer:
                        student_answer = student_answer.split('.')[0].strip()
                    is_correct = student_answer == correct_answer_str
                if is_correct:
                    score = float(question.score)
        elif question.question_type == 'multiple_choice':
            correct_answer = question.correct_answer
            if correct_answer and isinstance(ans, list):
                if isinstance(correct_answer, list):
                    student_answers = []
                    for a in ans:
                        a_str = str(a).strip()
                        if '.' in a_str:
                            a_str = a_str.split('.')[0].strip()
                        student_answers.append(a_str)
                    is_correct = set(student_answers) == set(correct_answer)
                else:
                    is_correct = ans == correct_answer
                if is_correct:
                    score = float(question.score)
        elif question.question_type in ['text', 'fill_blank']:
            correct_answer = question.correct_answer
            if correct_answer:
                student_answer = str(ans).strip() if ans else ""
                
                if isinstance(correct_answer, list):
                    is_correct = student_answer in [str(item).strip() for item in correct_answer]
                else:
                    correct_answer_str = str(correct_answer).strip()
                    is_correct = student_answer == correct_answer_str
                
                if is_correct:
                    score = float(question.score)
        elif question.question_type == 'essay':
            # 问答题使用AI智能打分（支持动态Skill和知识库检索）
            print(f"📝 问答题AI智能打分: question_type={question.question_type}, survey_type={survey.survey_type}")
            
            try:
                # 获取课程名称（用于生成专业评分Skill）
                course_name = None
                course_id_str = None
                if survey.course_id:
                    course_id_str = str(survey.course_id)
                    # 尝试获取课程名称
                    try:
                        from app.models.course import Course
                        course = db.query(Course).filter(Course.id == survey.course_id).first()
                        if course:
                            course_name = course.name
                            print(f"📚 关联课程: {course_name}")
                    except Exception as ce:
                        print(f"⚠️ 获取课程信息失败: {ce}")
                
                # 获取知识点列表
                knowledge_points = None
                if hasattr(question, 'knowledge_points') and question.knowledge_points:
                    knowledge_points = question.knowledge_points
                    print(f"📖 知识点: {knowledge_points}")
                
                # 调用增强版AI打分服务
                grading_result = await essay_grading_service.grade_essay(
                    question_text=question.question_text,
                    question_type=question.question_type,
                    reference_answer=question.correct_answer,
                    grading_criteria=question.grading_criteria,
                    min_word_count=question.min_word_count,
                    student_answer=str(ans) if ans else "",
                    max_score=float(question.score),
                    # 新增参数：用于更精准的评分
                    knowledge_points=knowledge_points,
                    course_name=course_name,
                    survey_title=survey.title,
                    course_id=course_id_str
                )
                
                score = grading_result.get('score', 0)
                is_correct = grading_result.get('percentage', 0) >= 60
                teacher_comment = json.dumps(grading_result, ensure_ascii=False)
                
                print(f"✅ AI智能打分完成: score={score}, percentage={grading_result.get('percentage', 0)}%, is_correct={is_correct}")
                
            except Exception as e:
                print(f"❌ AI打分失败: {e}")
                import traceback
                traceback.print_exc()
                score = 0
                is_correct = False
                teacher_comment = f"AI打分失败: {str(e)}"
        
        total_score += score
        answer_count += 1
        
        a = AnswerModel(
            response_id=resp.id,
            question_id=UUID(qid),
            student_answer=ans,
            is_correct=is_correct,
            score=score,
            teacher_comment=teacher_comment,
            auto_graded=True,
        )
        db.add(a)
    
    print(f"✅ 保存答案记录: {answer_count} 个答案, 总分: {total_score}")
    
    # 计算总分和百分比
    resp.total_score = total_score
    resp.percentage_score = (total_score / survey.total_score * 100) if survey.total_score > 0 else 0
    resp.is_passed = resp.percentage_score >= 60  # 百分比得分 >= 60% 为及格
    
    print(f"[SCORE] total={total_score}, percentage={resp.percentage_score}, passed={resp.is_passed}")
    
    db.commit()
    
    print(f"✅ 数据库提交成功")
    print(f"=" * 70)
    print(f"🎉 问卷提交完成")
    print(f"=" * 70)
    
    return {
        "message": "问卷提交成功",
        "survey_id": survey_id,
        "total_score": total_score,
        "percentage_score": resp.percentage_score,
        "is_passed": resp.is_passed
    }


# 异步打分函数（后台执行）
def grade_survey_async(response_id: str, survey_id: str, answers: Dict[str, Any]):
    """
    后台异步打分函数的包装器
    在独立的事件循环中执行实际的打分逻辑
    """
    try:
        # 在新的事件循环中运行异步打分
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_grade_survey_async_impl(response_id, survey_id, answers))
        finally:
            loop.close()
    except Exception as e:
        print(f"❌ 后台打分包装器失败: {e}")
        import traceback
        traceback.print_exc()


async def _grade_survey_async_impl(response_id: str, survey_id: str, answers: Dict[str, Any]):
    """
    后台异步打分函数
    """
    print(f"\n{'='*70}")
    print(f"🔄 后台异步打分开始")
    print(f"response_id: {response_id}")
    print(f"survey_id: {survey_id}")
    print(f"{'='*70}\n")
    
    # 创建新的数据库会话（因为原会话已关闭）
    db = SessionLocal()
    
    try:
        from app.services.essay_grading_service import essay_grading_service
        
        # 获取提交记录和问卷信息
        resp = db.query(SurveyResponseModel).filter(SurveyResponseModel.id == UUID(response_id)).first()
        if not resp:
            print(f"❌ 找不到提交记录: {response_id}")
            return
        
        survey = db.query(SurveyModel).filter(SurveyModel.id == UUID(survey_id)).first()
        if not survey:
            print(f"❌ 找不到问卷: {survey_id}")
            return
        
        total_score = 0
        answer_count = 0
        
        # 获取所有已保存的答案记录
        saved_answers = db.query(AnswerModel).filter(AnswerModel.response_id == UUID(response_id)).all()
        
        for answer_record in saved_answers:
            question = db.query(QuestionModel).filter(
                QuestionModel.id == answer_record.question_id
            ).first()
            
            if not question:
                continue
            
            ans = answer_record.student_answer
            is_correct = False
            score = 0
            teacher_comment = None
            
            # 根据题目类型进行自动判分
            if question.question_type in ['single_choice', 'judgment']:
                correct_answer = question.correct_answer
                if correct_answer:
                    if isinstance(correct_answer, list):
                        is_correct = ans in correct_answer
                    else:
                        student_answer = str(ans).strip()
                        correct_answer_str = str(correct_answer).strip()
                        if '.' in student_answer:
                            student_answer = student_answer.split('.')[0].strip()
                        is_correct = student_answer == correct_answer_str
                    if is_correct:
                        score = float(question.score)
            
            elif question.question_type == 'multiple_choice':
                correct_answer = question.correct_answer
                if correct_answer and isinstance(ans, list):
                    if isinstance(correct_answer, list):
                        student_answers = []
                        for a in ans:
                            a_str = str(a).strip()
                            if '.' in a_str:
                                a_str = a_str.split('.')[0].strip()
                            student_answers.append(a_str)
                        is_correct = set(student_answers) == set(correct_answer)
                    else:
                        is_correct = ans == correct_answer
                    if is_correct:
                        score = float(question.score)
            
            elif question.question_type in ['text', 'fill_blank']:
                correct_answer = question.correct_answer
                if correct_answer:
                    student_answer = str(ans).strip() if ans else ""
                    
                    if isinstance(correct_answer, list):
                        is_correct = student_answer in [str(item).strip() for item in correct_answer]
                    else:
                        correct_answer_str = str(correct_answer).strip()
                        is_correct = student_answer == correct_answer_str
                    
                    if is_correct:
                        score = float(question.score)
            
            elif question.question_type == 'essay':
                # 问答题使用AI打分
                print(f"📝 问答题AI打分: question_id={question.id}")
                
                try:
                    grading_result = await essay_grading_service.grade_essay(
                        question_text=question.question_text,
                        question_type=question.question_type,
                        reference_answer=question.correct_answer,
                        grading_criteria=question.grading_criteria,
                        min_word_count=question.min_word_count,
                        student_answer=str(ans) if ans else "",
                        max_score=float(question.score)
                    )
                    
                    score = grading_result.get('score', 0)
                    is_correct = grading_result.get('percentage', 0) >= 60
                    teacher_comment = json.dumps(grading_result, ensure_ascii=False)
                    
                    print(f"✅ AI打分完成: score={score}, is_correct={is_correct}")
                    
                except Exception as e:
                    print(f"❌ AI打分失败: {e}")
                    score = 0
                    is_correct = False
                    teacher_comment = f"AI打分失败: {str(e)}"
            
            # 更新答案记录
            answer_record.is_correct = is_correct
            answer_record.score = score
            answer_record.teacher_comment = teacher_comment
            answer_record.auto_graded = True
            
            total_score += score
            answer_count += 1
        
        # 更新提交记录
        resp.total_score = total_score
        resp.percentage_score = (total_score / survey.total_score * 100) if survey.total_score > 0 else 0
        resp.is_passed = resp.percentage_score >= 60
        resp.status = "completed"  # 打分完成，更新状态
        
        db.commit()
        
        print(f"\n{'='*70}")
        print(f"✅ 后台异步打分完成")
        print(f"总分: {total_score}, 百分比: {resp.percentage_score}%, 及格: {resp.is_passed}")
        print(f"{'='*70}\n")
        
    except Exception as e:
        print(f"\n❌ 后台打分失败: {e}")
        import traceback
        traceback.print_exc()
        try:
            # 即使打分失败，也要更新状态避免一直显示grading
            resp.status = "completed"
            db.commit()
        except:
            db.rollback()
    finally:
        db.close()
