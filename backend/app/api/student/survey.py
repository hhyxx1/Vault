from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.database import get_db
from app.models.user import User
from app.models.survey import Survey as SurveyModel, Question as QuestionModel, SurveyResponse as SurveyResponseModel
from app.utils.auth import get_current_user

router = APIRouter()

# Pydantic响应模型定义
class QuestionResponse(BaseModel):
    id: str
    text: str
    type: str
    options: Union[List[str], None] = None
    required: bool = True

class SurveyResponse(BaseModel):
    id: str
    title: str
    description: Union[str, None] = None
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
            end_time = getattr(survey, "end_time", None)
            result.append({
                "id": str(survey.id),
                "title": survey.title,
                "description": survey.description or "",
                "questionCount": question_count,
                "status": "published",
                "releaseType": getattr(survey, "release_type", None) or "in_class",
                "publishedAt": survey.published_at.strftime("%Y-%m-%d") if survey.published_at else None,
                "dueDate": end_time.strftime("%Y-%m-%d") if end_time else None,
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
    """
    if getattr(current_user, "role", None) != "student":
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    survey = db.query(SurveyModel).filter(SurveyModel.id == survey_id).first()
    if not survey or survey.status != "published":
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    class_ids = _get_student_class_ids(db, str(current_user.id))
    target_ids = getattr(survey, "target_class_ids", None) or []
    legacy_class_id = getattr(survey, "class_id", None)
    visible = (target_ids and any(cid in class_ids for cid in (target_ids if isinstance(target_ids, list) else []))) or (
        legacy_class_id and str(legacy_class_id) in class_ids
    )
    if not visible:
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    questions = db.query(QuestionModel).filter(QuestionModel.survey_id == survey_id).order_by(QuestionModel.question_order).all()
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
                options=q.options,
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
    用于「查看详情」：已提交且 total_score 不为空视为老师已公布成绩，可显示分数；否则显示「等待老师公布成绩」。
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
    submitted = response.submit_time is not None
    score_published = response.total_score is not None
    return {
        "submitted": submitted,
        "scorePublished": score_published,
        "totalScore": float(response.total_score) if response.total_score is not None else None,
        "percentageScore": float(response.percentage_score) if response.percentage_score is not None else None,
        "submitTime": response.submit_time.isoformat() if response.submit_time else None,
        "isPassed": response.is_passed,
    }


@router.post("/{survey_id}/submit")
async def submit_survey(
    survey_id: str,
    submission: SurveySubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    提交问卷答案。会写入 survey_responses 与 answers；若已有提交记录则更新或按 attempt 追加。
    """
    if getattr(current_user, "role", None) != "student":
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    survey = db.query(SurveyModel).filter(SurveyModel.id == survey_id).first()
    if not survey or survey.status != "published":
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
    class_ids = _get_student_class_ids(db, str(current_user.id))
    target_ids = getattr(survey, "target_class_ids", None) or []
    legacy_class_id = getattr(survey, "class_id", None)
    visible = (target_ids and any(str(cid) in class_ids for cid in (target_ids if isinstance(target_ids, list) else []))) or (
        legacy_class_id and str(legacy_class_id) in class_ids
    )
    if not visible:
        raise HTTPException(status_code=404, detail="问卷不存在或未发布")
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
    attempt = (existing.attempt_number + 1) if existing else 1
    resp = SurveyResponseModel(
        survey_id=UUID(survey_id),
        student_id=sid,
        attempt_number=attempt,
        status="submitted",
        submit_time=datetime.utcnow(),
    )
    db.add(resp)
    db.flush()
    answers = submission.answers or {}
    for qid, ans in answers.items():
        from app.models.survey import Answer as AnswerModel
        a = AnswerModel(
            response_id=resp.id,
            question_id=UUID(qid),
            student_answer=ans,
        )
        db.add(a)
    db.commit()
    return {"message": "问卷提交成功", "survey_id": survey_id}
