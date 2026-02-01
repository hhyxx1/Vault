from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from pathlib import Path
import os

from app.database import get_db
from app.models.user import User
from app.models.course import Course
from app.utils.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

class DocumentResponse(BaseModel):
    id: str
    file_name: str
    file_path: str
    file_size: int
    file_type: str
    uploaded_at: str
    
    class Config:
        from_attributes = True

class CourseDocumentsResponse(BaseModel):
    course_id: str
    course_code: str
    course_name: str
    teacher_name: str
    documents: List[DocumentResponse]
    total_count: int

@router.get("/{course_id}/documents", response_model=CourseDocumentsResponse)
async def get_course_documents(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取课程的所有文档（学生只读）"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    
    # 查询课程信息
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    # 验证学生是否加入了这个课程的班级
    enrolled = db.execute(
        text("""
            SELECT COUNT(*) 
            FROM class_students cs
            INNER JOIN classes c ON cs.class_id = c.id
            WHERE cs.student_id = :student_id 
            AND c.course_id = :course_id
            AND cs.status = 'active'
            AND c.status = 'active'
        """),
        {"student_id": str(current_user.id), "course_id": str(course_id)}
    ).scalar()
    
    if not enrolled:
        raise HTTPException(status_code=403, detail="您未加入此课程的班级")
    
    # 查询课程文档（使用 raw SQL，course_documents 表无 ORM 模型）
    result = db.execute(
        text("""
            SELECT id, file_name, file_path, file_size, file_type, created_at
            FROM course_documents
            WHERE course_id = :course_id
            AND upload_status = 'completed'
            ORDER BY created_at DESC
        """),
        {"course_id": str(course_id)}
    )
    
    documents = []
    for row in result:
        documents.append(DocumentResponse(
            id=str(row[0]),
            file_name=row[1],
            file_path=row[2],
            file_size=row[3] or 0,
            file_type=row[4] or "",
            uploaded_at=row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else ""
        ))
    
    # 获取教师姓名
    teacher = db.query(User).filter(User.id == course.teacher_id).first()
    teacher_name = teacher.full_name if teacher and teacher.full_name else teacher.username if teacher else "未知教师"
    
    return CourseDocumentsResponse(
        course_id=str(course.id),
        course_code=course.course_code,
        course_name=course.course_name,
        teacher_name=teacher_name,
        documents=documents,
        total_count=len(documents)
    )

@router.get("/{course_id}/documents/{document_id}/download")
async def download_document(
    course_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """下载课程文档"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以下载文档")
    
    # 验证学生是否加入了这个课程的班级
    enrolled = db.execute(
        text("""
            SELECT COUNT(*) 
            FROM class_students cs
            INNER JOIN classes c ON cs.class_id = c.id
            WHERE cs.student_id = :student_id 
            AND c.course_id = :course_id
            AND cs.status = 'active'
            AND c.status = 'active'
        """),
        {"student_id": str(current_user.id), "course_id": str(course_id)}
    ).scalar()
    
    if not enrolled:
        raise HTTPException(status_code=403, detail="您未加入此课程的班级")
    
    # 查询文档
    doc_row = db.execute(
        text("""
            SELECT file_name, file_path
            FROM course_documents
            WHERE id = :document_id
            AND course_id = :course_id
            AND upload_status = 'completed'
        """),
        {"document_id": str(document_id), "course_id": str(course_id)}
    ).fetchone()
    
    if not doc_row:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    file_name, file_path = doc_row[0], doc_row[1]
    
    # 文件路径可能是绝对路径或相对路径
    file_full_path = Path(file_path)
    if not file_full_path.is_absolute():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        file_full_path = backend_dir / "app" / file_path
    
    if not file_full_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=str(file_full_path),
        filename=file_name,
        media_type='application/octet-stream'
    )
