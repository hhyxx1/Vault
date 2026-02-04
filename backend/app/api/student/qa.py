from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import os
import time
from pathlib import Path
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

class UploadResponse(BaseModel):
    message: str
    file_name: str
    status: str

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

@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    course_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    学生上传个人文档或代码文件，解析后加入私有知识库
    """
    # 1. 验证文件类型
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = ['.pdf', '.txt', '.md', '.py', '.js', '.ts', '.java', '.c', '.cpp']
    if file_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_ext}")

    # 2. 保存文件
    backend_dir = Path(__file__).resolve().parent.parent.parent.parent
    upload_dir = backend_dir / "static" / "student_uploads" / str(current_user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = int(time.time() * 1000)
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = upload_dir / safe_filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # 3. 后台处理：解析并存入向量库
    metadata = {
        "student_id": str(current_user.id),
        "file_name": file.filename,
        "upload_time": timestamp,
        "type": "student_personal"
    }
    
    background_tasks.add_task(
        qa_service.process_and_store_document,
        file_path=str(file_path),
        course_id=course_id, # 如果传了 course_id，则关联到课程知识库，否则存入通用集合
        metadata=metadata
    )

    return UploadResponse(
        message="文件已上传，正在后台解析中...",
        file_name=file.filename,
        status="processing"
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
