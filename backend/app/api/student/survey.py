from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter()

# 模型定义
class Question(BaseModel):
    id: str
    text: str
    type: str
    options: List[str] | None = None
    required: bool = True

class Survey(BaseModel):
    id: str
    title: str
    description: str | None = None
    status: str
    questions: List[Question]

class SurveySubmission(BaseModel):
    answers: Dict[str, Any]

@router.get("", response_model=List[Survey])
async def get_surveys():
    """
    获取学生可用的问卷列表
    """
    # TODO: 从数据库获取问卷
    return [
        Survey(
            id="1",
            title="课程反馈调查",
            description="请对本课程进行评价",
            status="active",
            questions=[
                Question(
                    id="q1",
                    text="您对本课程的整体满意度如何？",
                    type="radio",
                    options=["非常满意", "满意", "一般", "不满意"],
                    required=True
                )
            ]
        )
    ]

@router.get("/{survey_id}", response_model=Survey)
async def get_survey_detail(survey_id: str):
    """
    获取问卷详情
    """
    # TODO: 从数据库获取问卷详情
    return Survey(
        id=survey_id,
        title="课程反馈调查",
        description="请认真填写",
        status="active",
        questions=[]
    )

@router.post("/{survey_id}/submit")
async def submit_survey(survey_id: str, submission: SurveySubmission):
    """
    提交问卷答案
    """
    # TODO: 保存到数据库
    return {
        "message": "问卷提交成功",
        "survey_id": survey_id
    }
