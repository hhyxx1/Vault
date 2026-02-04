from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import os
import time
import secrets
from pathlib import Path
from datetime import datetime, timedelta
from app.services.qa_service import qa_service
from app.database import get_db
from app.utils.auth import get_current_user
from app.models.user import User
from app.models.qa import QAShare, QARecord, QASession

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

class ShareRequest(BaseModel):
    title: str = Field(..., description="分享标题")
    description: Optional[str] = Field(None, description="分享描述")
    access_password: Optional[str] = Field(None, min_length=4, max_length=20, description="访问密码")
    expires_in_hours: Optional[int] = Field(24, ge=1, le=720, description="过期时间（小时）")
    session_id: Optional[str] = Field(None, description="会话ID，分享整个会话")
    qa_record_id: Optional[str] = Field(None, description="问答记录ID，分享单条问答")
    limit: Optional[int] = Field(None, ge=1, le=50, description="分享最近的N条问答记录")

    @field_validator('access_password', mode='before')
    @classmethod
    def validate_password(cls, v):
        if v == '':
            return None
        return v

class ShareResponse(BaseModel):
    share_code: str
    share_url: str
    expires_at: str
    access_required: bool

class SharedQAItem(BaseModel):
    question: str
    answer: str
    timestamp: str

class SharedSessionResponse(BaseModel):
    share_code: str
    title: str
    description: Optional[str]
    sharer_name: str
    created_at: str
    expires_at: Optional[str]
    view_count: int
    items: List[SharedQAItem]

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

@router.post("/share", response_model=ShareResponse)
async def create_share(
    request: ShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建分享链接
    可以分享单条问答、整个会话或最近的N条问答记录
    """
    print(f"📨 分享请求参数: {request.model_dump()}")
    
    # 验证必须提供session_id、qa_record_id或limit之一
    if not request.session_id and not request.qa_record_id and not request.limit:
        raise HTTPException(
            status_code=400,
            detail="必须提供session_id、qa_record_id或limit之一"
        )
    
    # 验证资源是否存在且属于当前用户
    if request.qa_record_id:
        qa_record = db.query(QARecord).filter(
            QARecord.id == request.qa_record_id,
            QARecord.student_id == current_user.id
        ).first()
        if not qa_record:
            raise HTTPException(
                status_code=404,
                detail="问答记录不存在或无权访问"
            )
    
    if request.session_id:
        session = db.query(QASession).filter(
            QASession.id == request.session_id,
            QASession.student_id == current_user.id
        ).first()
        if not session:
            raise HTTPException(
                status_code=404,
                detail="会话不存在或无权访问"
            )
    
    # 生成唯一的分享码
    share_code = secrets.token_urlsafe(16)
    
    # 计算过期时间
    expires_at = datetime.utcnow() + timedelta(hours=request.expires_in_hours) if request.expires_in_hours else None
    
    # 创建分享记录
    share = QAShare(
        share_code=share_code,
        sharer_id=current_user.id,
        session_id=request.session_id,
        qa_record_id=request.qa_record_id,
        title=request.title,
        description=request.description,
        access_password=request.access_password,
        expires_at=expires_at,
        limit=request.limit
    )
    
    db.add(share)
    db.commit()
    db.refresh(share)
    
    return ShareResponse(
        share_code=share_code,
        share_url=f"/api/student/qa/share/{share_code}",
        expires_at=expires_at.isoformat() if expires_at else "",
        access_required=bool(request.access_password)
    )

@router.get("/share/{share_code}", response_model=SharedSessionResponse)
async def get_shared_content(
    share_code: str,
    access_password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取分享的问答内容
    """
    # 查找分享记录
    share = db.query(QAShare).filter(
        QAShare.share_code == share_code,
        QAShare.is_active == True
    ).first()
    
    if not share:
        raise HTTPException(
            status_code=404,
            detail="分享链接不存在或已失效"
        )
    
    # 检查是否过期
    if share.expires_at and share.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="分享链接已过期"
        )
    
    # 验证访问密码
    if share.access_password and share.access_password != access_password:
        raise HTTPException(
            status_code=403,
            detail="访问密码错误"
        )
    
    # 增加访问次数
    share.view_count += 1
    db.commit()
    
    # 获取分享者信息
    sharer = db.query(User).filter(User.id == share.sharer_id).first()
    sharer_name = sharer.full_name if sharer else "未知用户"
    
    # 获取分享内容
    items = []
    if share.qa_record_id:
        qa_record = db.query(QARecord).filter(
            QARecord.id == share.qa_record_id
        ).first()
        if qa_record:
            items.append(SharedQAItem(
                question=qa_record.question,
                answer=qa_record.answer or "",
                timestamp=qa_record.created_at.isoformat() if qa_record.created_at else ""
            ))
    elif share.session_id:
        records = db.query(QARecord).filter(
            QARecord.student_id == share.sharer_id
        ).order_by(QARecord.created_at.asc()).all()
        for record in records:
            items.append(SharedQAItem(
                question=record.question,
                answer=record.answer or "",
                timestamp=record.created_at.isoformat() if record.created_at else ""
            ))
    elif share.limit:
        records = db.query(QARecord).filter(
            QARecord.student_id == share.sharer_id
        ).order_by(QARecord.created_at.desc()).limit(share.limit).all()
        for record in reversed(records):
            items.append(SharedQAItem(
                question=record.question,
                answer=record.answer or "",
                timestamp=record.created_at.isoformat() if record.created_at else ""
            ))
    
    return SharedSessionResponse(
        share_code=share_code,
        title=share.title,
        description=share.description,
        sharer_name=sharer_name,
        created_at=share.created_at.isoformat() if share.created_at else "",
        expires_at=share.expires_at.isoformat() if share.expires_at else None,
        view_count=share.view_count,
        items=items
    )

@router.delete("/share/{share_code}")
async def delete_share(
    share_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    删除分享链接
    """
    share = db.query(QAShare).filter(
        QAShare.share_code == share_code,
        QAShare.sharer_id == current_user.id
    ).first()
    
    if not share:
        raise HTTPException(
            status_code=404,
            detail="分享链接不存在或无权删除"
        )
    
    share.is_active = False
    db.commit()
    
    return {"message": "分享链接已删除"}
