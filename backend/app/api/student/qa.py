from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict
from app.services.qa_service import QAService
import shutil
import os
from pathlib import Path
import uuid

router = APIRouter()
qa_service = QAService()

# 确保上传目录存在
UPLOAD_DIR = Path("static/uploads/qa")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 请求/响应模型
class QuestionRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

class QuestionResponse(BaseModel):
    answer: str
    session_id: str
    sources: list[dict] = []

class QAHistoryItem(BaseModel):
    id: str
    question: str
    answer: str
    timestamp: str

@router.post("/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    """
    学生提交问题，获取AI回答
    """
    # 模拟 session_id
    session_id = request.session_id or "default_session"
    student_id = "test_student"  # 临时固定
    
    try:
        result = await qa_service.get_ai_answer(
            question=request.question,
            session_id=session_id,
            student_id=student_id
        )
        return QuestionResponse(
            answer=result["answer"],
            session_id=session_id,
            sources=result.get("sources", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    学生上传文档（PDF、代码等），解析并存入向量库
    """
    # 模拟 student_id
    student_id = "test_student"
    session_id = session_id or str(uuid.uuid4())
    
    # 保存文件
    file_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 处理文件
        result = await qa_service.process_file_upload(file_path, student_id)
        
        if result["success"]:
            return {
                "session_id": session_id,
                "chunk_count": result["chunk_count"],
                "filename": file.filename
            }
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    except Exception as e:
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[QAHistoryItem])
async def get_history():
    """
    获取问答历史记录
    """
    # TODO: 从数据库获取历史记录
    return [
        QAHistoryItem(
            id="1",
            question="什么是React？",
            answer="React是一个用于构建用户界面的JavaScript库。",
            timestamp="2026-01-26T10:00:00"
        )
    ]
