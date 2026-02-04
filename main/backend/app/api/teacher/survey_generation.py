"""问卷AI生成API端点"""

import asyncio
import json as json_module
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.survey_generation_service import SurveyGenerationService
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter()


# ==================== 请求模型 ====================

class AIGenerationRequest(BaseModel):
    """AI生成问卷请求。仅传 description 时，由 skill 根据描述解析题型与数量；描述未写则默认20题、三种题型。"""
    description: str = Field(..., description="问卷描述", min_length=5)
    question_count: Optional[int] = Field(None, description="题目数量（可选；不传则由描述解析，未写默认20）", ge=1, le=50)
    include_types: Optional[List[str]] = Field(
        None, 
        description="包含的题型。不传则由描述解析，未写默认三种题型"
    )
    course_id: Optional[str] = Field(None, description="关联的课程ID（可选）")
    auto_save: bool = Field(False, description="是否自动保存到数据库，默认false让用户编辑后再保存")


class KnowledgeBasedGenerationRequest(BaseModel):
    """基于知识库生成问卷请求"""
    description: str = Field(..., description="问卷描述", min_length=5)
    course_id: Optional[str] = Field(None, description="课程ID（可选，不传则在所有知识库中检索）")
    question_count: int = Field(20, description="题目数量，默认20道", ge=1, le=50)
    include_types: Optional[List[str]] = Field(
        None,
        description="包含的题型: choice(选择题), judge(判断题), essay(问答题)。不指定则三种都包含"
    )
    auto_save: bool = Field(False, description="是否自动保存到数据库，默认false让用户编辑后再保存")


class SurveyGenerationResponse(BaseModel):
    """问卷生成响应"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    survey_id: Optional[str] = None  # 如果保存到数据库，返回survey_id


# ==================== API端点 ====================

@router.post("/generate/ai", response_model=SurveyGenerationResponse)
async def generate_survey_ai(
    request: AIGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI生成问卷
    
    根据用户描述，使用DeepSeek AI生成完整问卷，包含题目、答案、分数和解析。
    
    **功能特点**：
    - 支持选择题、判断题、问答题三种题型
    - 题型可以灵活组合：只要choice、只要judge、choice+judge等
    - 自动生成题目、答案、分数和详细解析
    - 基于AI思考和网络知识生成
    - 确保答案准确性和格式规范
    - 可选自动保存到数据库
    
    **请求示例**：
    ```json
    {
        "description": "生成一份Python基础语法测试题",
        "question_count": 10,
        "include_types": ["choice", "judge"],  # 只要选择题和判断题
        "course_id": "uuid-string",  # 可选
        "auto_save": true
    }
    ```
    """
    try:
        # 验证用户权限（仅教师可用）
        if current_user.role != "teacher":
            raise HTTPException(status_code=403, detail="只有教师可以使用AI生成功能")
        
        # 验证题型参数（仅当显式传入时）
        if request.include_types is not None:
            valid_types = {"choice", "judge", "essay"}
            invalid = set(request.include_types) - valid_types
            if invalid:
                raise HTTPException(
                    status_code=400, 
                    detail=f"无效的题型: {invalid}。有效题型：choice, judge, essay"
                )
        
        # 初始化生成服务
        service = SurveyGenerationService()
        
        # 调用AI生成（不传 question_count/include_types 时由 skill 根据描述解析，默认20题、三种题型）
        survey_data = service.generate_survey_ai(
            description=request.description,
            question_count=request.question_count,
            include_types=request.include_types
        )
        
        # 验证生成结果
        if not service.validate_survey_data(survey_data):
            raise ValueError("生成的问卷数据格式不正确")
        
        # 自动保存到数据库
        survey_id = None
        if request.auto_save:
            saved_survey = service.save_to_database(
                survey_data=survey_data,
                teacher_id=str(current_user.id),
                course_id=request.course_id,
                generation_method='ai',
                generation_prompt=request.description,
                db=db
            )
            survey_id = str(saved_survey.id)
        
        return SurveyGenerationResponse(
            success=True,
            message="问卷生成成功" + ("并已保存" if request.auto_save else ""),
            data=survey_data,
            survey_id=survey_id
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"AI生成问卷错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


def _sse_event(data: dict) -> str:
    """格式化为 SSE 单条事件"""
    return f"data: {json_module.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/generate/ai/stream")
async def generate_survey_ai_stream(
    request: AIGenerationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI生成问卷（流式接口，带进度）
    返回 Server-Sent Events：start -> generating -> parsing -> done | error
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以使用AI生成功能")
    if request.include_types is not None:
        valid_types = {"choice", "judge", "essay"}
        invalid = set(request.include_types) - valid_types
        if invalid:
            raise HTTPException(status_code=400, detail=f"无效的题型: {invalid}")

    async def event_stream():
        service = SurveyGenerationService()
        try:
            yield _sse_event({"stage": "start", "progress": 0, "message": "准备生成…"})
            yield _sse_event({"stage": "generating", "progress": 15, "message": "正在生成题目…"})
            # 在线程池中执行阻塞的 LLM 调用
            survey_data = await asyncio.to_thread(
                service.generate_survey_ai,
                description=request.description,
                question_count=request.question_count,
                include_types=request.include_types,
            )
            yield _sse_event({"stage": "parsing", "progress": 90, "message": "正在解析结果…"})
            if not service.validate_survey_data(survey_data):
                yield _sse_event({"stage": "error", "progress": 0, "message": "生成的问卷数据格式不正确"})
                return
            yield _sse_event({"stage": "done", "progress": 100, "message": "完成", "data": survey_data})
        except Exception as e:
            msg = str(e)
            yield _sse_event({"stage": "error", "progress": 0, "message": msg})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/generate/knowledge-based", response_model=SurveyGenerationResponse)
async def generate_survey_knowledge_based(
    request: KnowledgeBasedGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    基于知识库生成问卷
    
    根据课程知识库内容生成问卷，确保题目与课程文档紧密相关。
    
    **功能特点**：
    - 从ChromaDB向量数据库检索课程文档
    - 基于实际教学内容生成题目
    - 每道题标注知识来源
    - 不是网上搜索，而是基于已上传的课程资料
    - 题型可以灵活组合
    - 自动保存到数据库
    
    **使用前提**：
    - 课程必须已上传相关文档
    - 知识库中有足够的内容
    
    **请求示例**：
    ```json
    {
        "description": "生成操作系统进程管理相关的测试题",
        "course_id": "uuid-string",
        "question_count": 10,
        "include_types": ["choice", "essay"],  # 只要选择题和问答题
        "auto_save": true
    }
    ```
    """
    try:
        # 验证用户权限
        if current_user.role != "teacher":
            raise HTTPException(status_code=403, detail="只有教师可以使用此功能")
        
        # 验证题型参数
        if request.include_types:
            valid_types = {"choice", "judge", "essay"}
            invalid = set(request.include_types) - valid_types
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的题型: {invalid}。有效题型：choice, judge, essay"
                )
        
        # 验证课程访问权限
        # TODO: 添加课程权限检查
        
        # 初始化生成服务
        service = SurveyGenerationService()
        
        # 调用基于知识库的生成
        # course_id是可选的，不传则在所有知识库中检索
        # 注意：course_id是UUID字符串，需要先验证格式
        parsed_course_id = None
        if request.course_id:
            parsed_course_id = request.course_id
        
        # 调用基于知识库的生成
        survey_data = service.generate_survey_knowledge_based(
            description=request.description,
            course_id=parsed_course_id,
            question_count=request.question_count,
            include_types=request.include_types
        )
        
        # 验证生成结果
        if not service.validate_survey_data(survey_data):
            raise ValueError("生成的问卷数据格式不正确")
        
        # 自动保存到数据库
        survey_id = None
        if request.auto_save:
            saved_survey = service.save_to_database(
                survey_data=survey_data,
                teacher_id=str(current_user.id),
                course_id=request.course_id,
                generation_method='knowledge_based',
                generation_prompt=request.description,
                db=db
            )
            survey_id = str(saved_survey.id)
            
        return SurveyGenerationResponse(
            success=True,
            message="问卷生成成功" + ("并已保存" if request.auto_save else ""),
            data=survey_data,
            survey_id=survey_id
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"基于知识库生成问卷错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


class SaveSurveyRequest(BaseModel):
    """保存问卷请求"""
    survey_title: str = Field(..., description="问卷标题")
    description: Optional[str] = Field(None, description="问卷描述")
    questions: List[Dict[str, Any]] = Field(..., description="题目列表")
    course_id: Optional[str] = Field(None, description="课程ID")
    generation_method: str = Field("ai", description="生成方式: ai, knowledge_based, manual")
    generation_prompt: Optional[str] = Field(None, description="生成提示词")


@router.post("/save", response_model=SurveyGenerationResponse)
async def save_survey(
    request: SaveSurveyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    保存问卷到数据库
    
    前端编辑完成后调用此接口保存。
    """
    try:
        service = SurveyGenerationService()
        
        # 构建问卷数据
        survey_data = {
            "survey_title": request.survey_title,
            "description": request.description or "",
            "questions": request.questions
        }
        
        # 验证问卷数据
        if not service.validate_survey_data(survey_data):
            raise ValueError("问卷数据格式不正确")
        
        # 保存到数据库
        saved_survey = service.save_to_database(
            survey_data=survey_data,
            teacher_id=str(current_user.id),
            course_id=request.course_id,
            generation_method=request.generation_method,
            generation_prompt=request.generation_prompt,
            db=db
        )
        
        return SurveyGenerationResponse(
            success=True,
            message="问卷保存成功",
            data=survey_data,
            survey_id=str(saved_survey.id)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"保存问卷错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.get("/list")
async def list_surveys(
    course_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取问卷列表
    
    返回当前教师创建的问卷列表。
    """
    try:
        from app.models.survey import Survey
        
        # 构建查询
        query = db.query(Survey).filter(Survey.teacher_id == current_user.id)
        
        if course_id:
            query = query.filter(Survey.course_id == course_id)
        
        if status:
            query = query.filter(Survey.status == status)
        
        # 按创建时间倒序
        query = query.order_by(Survey.created_at.desc())
        
        # 分页
        total = query.count()
        surveys = query.offset(skip).limit(limit).all()
        
        # 格式化返回
        survey_list = []
        for survey in surveys:
            survey_list.append({
                "id": str(survey.id),
                "title": survey.title,
                "description": survey.description,
                "generation_method": survey.generation_method,
                "status": survey.status,
                "total_score": survey.total_score,
                "question_count": len(survey.questions) if survey.questions else 0,
                "created_at": survey.created_at.isoformat(),
                "updated_at": survey.updated_at.isoformat()
            })
        
        return {
            "success": True,
            "total": total,
            "surveys": survey_list
        }
        
    except Exception as e:
        print(f"获取问卷列表错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/test-skills")
async def test_skills_loading(
    current_user: User = Depends(get_current_user)
):
    """
    测试技能加载功能（调试用）
    """
    try:
        service = SurveyGenerationService()
        skill_names = service.skill_loader.get_skill_names()
        
        return {
            "success": True,
            "loaded_skills": skill_names,
            "skill_count": len(skill_names)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
