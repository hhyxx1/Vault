from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter()

# 模型定义
class SurveyCreate(BaseModel):
    title: str
    description: str | None = None
    questions: List[Dict[str, Any]]

class SurveyInfo(BaseModel):
    id: str
    title: str
    status: str
    responses: int
    total: int

class SurveyResults(BaseModel):
    survey_id: str
    title: str
    total_responses: int
    results: Dict[str, Any]

@router.get("", response_model=List[SurveyInfo])
async def get_surveys():
    """
    获取教师创建的所有问卷
    """
    # TODO: 从数据库获取问卷列表
    return [
        SurveyInfo(
            id="1",
            title="课程反馈调查",
            status="active",
            responses=45,
            total=128
        ),
        SurveyInfo(
            id="2",
            title="期中测评",
            status="closed",
            responses=120,
            total=128
        )
    ]

@router.post("", response_model=SurveyInfo)
async def create_survey(survey: SurveyCreate):
    """
    创建新问卷
    """
    # TODO: 保存到数据库
    return SurveyInfo(
        id="new_001",
        title=survey.title,
        status="draft",
        responses=0,
        total=0
    )

@router.get("/{survey_id}/results", response_model=SurveyResults)
async def get_survey_results(survey_id: str):
    """
    获取问卷统计结果
    """
    # TODO: 从数据库统计结果
    return SurveyResults(
        survey_id=survey_id,
        title="课程反馈调查",
        total_responses=45,
        results={
            "q1": {
                "非常满意": 20,
                "满意": 15,
                "一般": 8,
                "不满意": 2
            }
        }
    )
