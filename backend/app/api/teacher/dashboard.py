from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

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
