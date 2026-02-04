from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.services.qa_service import qa_service
from app.database import get_db
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter()

# 请求/响应模型
class QuestionRequest(BaseModel):
    question: str
    course_id: Optional[str] = None

class SourceItem(BaseModel):
    content: str
    file_name: str
    page_label: str
    score: Optional[float] = None

class QuestionResponse(BaseModel):
    answer: str
    question_id: str
    sources: List[SourceItem] = []

class QAHistoryItem(BaseModel):
    id: str
    question: str
    answer: str
    timestamp: str
    course_id: Optional[str] = None

@router.post("/ask", response_model=QuestionResponse)
async def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    学生提交问题，获取AI回答
    """
    # 1. 获取历史记录 (用于上下文)
    # 暂时取最近5条
    history_records = await qa_service.get_student_history(db, str(current_user.id), limit=5)
    history = [
        {"role": "user", "content": r.question} if i % 2 == 0 else {"role": "assistant", "content": r.answer}
        for i, r in enumerate(history_records)
        # 这里逻辑有点简单，理想情况应该是按照问答对来组织，或者 QARecord 本身就包含 Q&A
        # QARecord: question, answer. 所以一条 record 就是一对。
    ]
    # 重构 history list
    history_context = []
    for r in reversed(history_records): # 历史记录是按时间倒序查的，这里转为正序
        history_context.append({"role": "user", "content": r.question})
        if r.answer:
            history_context.append({"role": "assistant", "content": r.answer})

    # 2. 调用 AI Agent
    result = await qa_service.get_ai_answer(
        question=request.question,
        course_id=request.course_id,
        history=history_context
    )
    
    answer_text = result.get("answer", "")
    sources_data = result.get("sources", [])
    
    # 3. 保存问答记录到数据库
    record = await qa_service.create_qa_record(
        db=db,
        student_id=str(current_user.id),
        question=request.question,
        answer=answer_text,
        course_id=request.course_id,
        sources=sources_data
    )
    
    # 转换 sources 为 Pydantic 模型
    sources_resp = [
        SourceItem(
            content=s.get("content", ""),
            file_name=s.get("file_name", ""),
            page_label=s.get("page_label", ""),
            score=s.get("score")
        ) for s in sources_data
    ]
    
    return QuestionResponse(
        answer=answer_text,
        question_id=str(record.id) if record else "temp_id",
        sources=sources_resp
    )

@router.get("/history", response_model=List[QAHistoryItem])
async def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取问答历史记录
    """
    records = await qa_service.get_student_history(db, str(current_user.id), limit=50)
    
    return [
        QAHistoryItem(
            id=str(r.id),
            question=r.question,
            answer=r.answer or "",
            timestamp=r.created_at.isoformat() if r.created_at else "",
            course_id=str(r.course_id) if r.course_id else None
        )
        for r in records
    ]
