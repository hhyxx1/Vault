from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter()

# 请求/响应模型
class QuestionRequest(BaseModel):
    question: str

class QuestionResponse(BaseModel):
    answer: str
    question_id: str

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
    # TODO: 集成AI模型进行问答
    return QuestionResponse(
        answer=f"这是对问题「{request.question}」的回答示例。实际应用中会调用AI模型。",
        question_id="qa_001"
    )

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
