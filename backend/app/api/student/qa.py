from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from app.services.qa_service import qa_service
from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user
from app.services.file_enhancement import (
    get_file_info, 
    is_supported_file,
    get_code_analysis_prompt,
    get_document_summary_prompt,
    generate_dynamic_skill
)
from sqlalchemy.orm import Session
import shutil
import os
from pathlib import Path
import uuid

router = APIRouter()

# 确保上传目录存在 - 统一保存到 backend/app/api/static/qa_uploads
API_DIR = Path(__file__).resolve().parent.parent  # backend/app/api
UPLOAD_DIR = API_DIR / "static" / "qa_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 请求/响应模型
class QuestionRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

class QuestionResponse(BaseModel):
    answer: str
    session_id: str
    sources: List[Dict] = []
    intent: Optional[str] = None
    skill_used: Optional[str] = None

class QAHistoryItem(BaseModel):
    session_id: str
    title: str
    first_question: str
    message_count: int
    created_at: str
    updated_at: str

class ShareRequest(BaseModel):
    session_id: str

class ShareResponse(BaseModel):
    success: bool
    share_code: Optional[str] = None
    share_url: Optional[str] = None
    message_count: Optional[int] = None
    error: Optional[str] = None

class SharedConversation(BaseModel):
    success: bool
    title: Optional[str] = None
    messages: Optional[List[Dict]] = None
    created_at: Optional[str] = None
    error: Optional[str] = None

class FileUploadResponse(BaseModel):
    """文件上传响应"""
    success: bool
    file_id: str
    filename: str
    file_info: Dict  # 包含文件类型、图标、颜色等信息
    preview: Optional[str] = None  # 文件预览内容
    can_analyze: bool  # 是否可以分析（代码文件）
    can_summarize: bool  # 是否可以总结（文档文件）
    message: str

class FileAnalysisRequest(BaseModel):
    """文件分析请求"""
    file_id: str
    analysis_type: str  # 'code_analysis' or 'document_summary'
    session_id: Optional[str] = None

@router.post("/upload")
async def upload_file_and_parse(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    文件上传并解析 - 支持多种格式
    上传文件后自动解析内容并存入向量库
    支持：PDF、PPT、Word、代码文件等
    """
    student_id = str(current_user.id)
    session_id = session_id or str(uuid.uuid4())
    
    # 检查文件类型是否支持
    if not is_supported_file(file.filename):
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件类型。支持的格式包括：PDF、PPT、Word、代码文件等"
        )
    
    # 生成文件ID和路径
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    
    try:
        # 保存文件
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 获取文件信息
        file_info = get_file_info(file.filename)
        
        # 处理文件并存入向量库
        result = await qa_service.process_file_upload(file_path, student_id)
        
        if result["success"]:
            return {
                "success": True,
                "session_id": session_id,
                "file_id": file_id,
                "filename": file.filename,
                "file_info": file_info,
                "chunk_count": result["chunk_count"],
                "can_analyze": file_info['is_code'],
                "can_summarize": file_info['is_document'],
                "message": f"文件 {file.filename} 上传并解析成功"
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "文件解析失败"))
        
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            os.remove(file_path)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"文件上传失败：{str(e)}")

@router.post("/analyze-file")
async def analyze_file(
    request: FileAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    分析上传的文件（代码分析或文档总结）
    自动生成动态Skill并执行分析
    """
    student_id = str(current_user.id)
    session_id = request.session_id or str(uuid.uuid4())
    
    # 查找文件
    file_pattern = f"{request.file_id}_*"
    matching_files = list(UPLOAD_DIR.glob(file_pattern))
    
    if not matching_files:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    file_path = matching_files[0]
    filename = file_path.name.split('_', 1)[1]  # 去掉UUID前缀
    
    try:
        # 读取文件内容
        if request.analysis_type == 'code_analysis':
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            file_info = get_file_info(filename)
            language = file_info['extension'].upper()
            
            # 生成分析问题
            question = f"请分析以下{language}代码的质量并给出改进建议：\n\n```{language}\n{content}\n```"
            
        elif request.analysis_type == 'document_summary':
            # 先解析文档
            result = await qa_service.process_file_upload(file_path, student_id)
            if not result["success"]:
                raise HTTPException(status_code=500, detail=result["error"])
            
            question = f"请总结文件《{filename}》的核心要点和主要内容"
        
        else:
            raise HTTPException(status_code=400, detail="不支持的分析类型")
        
        # 使用QA服务处理（会自动生成动态Skill）
        answer_result = await qa_service.get_ai_answer(
            question=question,
            session_id=session_id,
            student_id=student_id,
            db=db
        )
        
        return {
            "success": True,
            "answer": answer_result["answer"],
            "session_id": answer_result["session_id"],
            "filename": filename,
            "analysis_type": request.analysis_type
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ask", response_model=QuestionResponse)
async def ask_question(
    request: QuestionRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    学生提交问题，获取AI回答
    
    工作流程：意图识别 → 知识检索 → Skill匹配 → 回答生成
    """
    # 从当前登录用户获取学生ID
    session_id = request.session_id or str(uuid.uuid4())
    student_id = str(current_user.id)
    
    try:
        result = await qa_service.get_ai_answer(
            question=request.question,
            session_id=session_id,
            student_id=student_id,
            db=db
        )
        return QuestionResponse(
            answer=result["answer"],
            session_id=result["session_id"],
            sources=result.get("sources", []),
            intent=result.get("intent"),
            skill_used=result.get("skill_used")
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-legacy")
async def upload_file_legacy(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    旧版文件上传（兼容）- 直接解析并存入向量库
    """
    # 从当前登录用户获取学生ID
    student_id = str(current_user.id)
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[QAHistoryItem])
async def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取问答历史记录（按会话分组）
    """
    # 从当前登录用户获取学生ID
    student_id = str(current_user.id)
    
    try:
        history = await qa_service.get_student_history(student_id, db)
        return [
            QAHistoryItem(
                session_id=item["session_id"],
                title=item["title"],
                first_question=item["first_question"],
                message_count=item["message_count"],
                created_at=item["created_at"],
                updated_at=item["updated_at"]
            )
            for item in history
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============ 对话分享功能 ============

@router.post("/share", response_model=ShareResponse)
async def create_share(
    request: ShareRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建对话分享链接
    """
    # 从当前登录用户获取学生ID
    student_id = str(current_user.id)
    
    try:
        result = await qa_service.create_share(
            session_id=request.session_id,
            student_id=student_id,
            db=db
        )
        
        if result.get("success"):
            return ShareResponse(
                success=True,
                share_code=result["share_code"],
                share_url=result["share_url"],
                message_count=result["message_count"]
            )
        else:
            return ShareResponse(
                success=False,
                error=result.get("error", "分享创建失败")
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shared/{share_code}", response_model=SharedConversation)
async def get_shared_conversation(share_code: str, db: Session = Depends(get_db)):
    """
    获取分享的对话内容（公开接口，无需登录）
    """
    try:
        result = await qa_service.get_shared_conversation(share_code, db)
        
        if result.get("success"):
            return SharedConversation(
                success=True,
                title=result["title"],
                messages=result["messages"],
                created_at=result["created_at"]
            )
        else:
            return SharedConversation(
                success=False,
                error=result.get("error", "获取分享内容失败")
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/session/{session_id}/messages")
async def get_session_messages(
    session_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取指定会话的所有消息
    """
    # 从当前登录用户获取学生ID
    student_id = str(current_user.id)
    
    try:
        messages = await qa_service.get_session_messages(session_id, student_id, db)
        return {"messages": messages, "session_id": session_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
