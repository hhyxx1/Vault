"""
课程知识库管理API
用于上传、管理课程相关的文档资料
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import os
import shutil
from pathlib import Path
from uuid import UUID
import mimetypes
import json

from app.database import get_db
from app.models.user import User
from app.models.course import Course
from app.utils.auth import get_current_user
from app.services.document_processor import document_processor
from app.services.vector_db_service import get_vector_db
from pydantic import BaseModel

router = APIRouter()

# 支持的文件类型
ALLOWED_EXTENSIONS = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.md': 'text/markdown'
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


async def process_document_background(
    document_id: str,
    course_id: str,
    file_path: str,
    file_name: str,
    file_type: str,
    db: Session
):
    """
    后台处理文档：提取文本、切分、向量化并存入数据库
    """
    try:
        print(f"🔄 开始处理文档: {file_name} (ID: {document_id})")
        
        # 1. 提取文档内容并切分
        metadata = {
            'document_id': document_id,
            'course_id': course_id,
            'file_name': file_name,
            'file_type': file_type
        }
        
        result = document_processor.process_document(file_path, file_type, metadata)
        chunks = result['chunks']
        
        print(f"📄 文档提取成功: {len(chunks)} 个文本块, {result['total_chars']} 字符")
        
        # 2. 获取向量数据库实例
        vector_db = get_vector_db()
        
        # 3. 处理每个文本块
        success_count = 0
        for chunk in chunks:
            chunk_text = chunk['text']
            chunk_index = chunk['chunk_index']
            
            # 3.1 存入PostgreSQL knowledge_base表
            chunk_id = f"{document_id}_chunk_{chunk_index}"
            
            # 生成向量
            embedding = vector_db.model.encode([chunk_text]).tolist()[0]
            embedding_json = json.dumps(embedding)  # 转为JSON字符串存储
            
            db.execute(
                text("""
                    INSERT INTO knowledge_base 
                    (document_id, course_id, chunk_text, chunk_index, chunk_metadata, embedding_vector)
                    VALUES (:document_id, :course_id, :chunk_text, :chunk_index, :chunk_metadata, :embedding_vector)
                """),
                {
                    "document_id": document_id,
                    "course_id": course_id,
                    "chunk_text": chunk_text,
                    "chunk_index": chunk_index,
                    "chunk_metadata": json.dumps(chunk['metadata']),
                    "embedding_vector": embedding_json
                }
            )
            
            # 3.2 存入ChromaDB向量数据库
            vector_db.add_document(
                doc_id=chunk_id,
                content=chunk_text,
                metadata={
                    'document_id': document_id,
                    'course_id': course_id,
                    'file_name': file_name,
                    'chunk_index': chunk_index,
                    'total_chunks': len(chunks)
                }
            )
            
            success_count += 1
        
        # 4. 更新文档处理状态
        db.execute(
            text("""
                UPDATE course_documents 
                SET processed_status = 'completed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :document_id
            """),
            {"document_id": document_id}
        )
        db.commit()
        
        print(f"✅ 文档处理完成: {file_name}, 成功处理 {success_count}/{len(chunks)} 个文本块")
        
    except Exception as e:
        print(f"❌ 文档处理失败: {file_name}, 错误: {str(e)}")
        
        # 更新错误状态
        try:
            db.execute(
                text("""
                    UPDATE course_documents 
                    SET processed_status = 'failed',
                        error_message = :error_message,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :document_id
                """),
                {
                    "document_id": document_id,
                    "error_message": str(e)
                }
            )
            db.commit()
        except:
            db.rollback()
            pass

# Pydantic schemas
class DocumentResponse(BaseModel):
    id: str
    course_id: str
    course_name: str
    file_name: str
    file_type: str
    file_size: int
    upload_status: str
    processed_status: str | None
    error_message: str | None
    created_at: str
    
    class Config:
        from_attributes = True

class CourseDocumentsResponse(BaseModel):
    course_id: str
    course_name: str
    document_count: int
    documents: List[DocumentResponse]

class KnowledgeBaseStats(BaseModel):
    total_documents: int
    total_courses_with_docs: int
    documents_by_course: List[dict]

@router.post("/courses/{course_id}/upload")
async def upload_course_document(
    course_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    overwrite: bool = Form(False),  # 是否覆盖同名文件
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    为指定课程上传文档到知识库
    支持格式: PDF, Word, PowerPoint, TXT, MD
    文档上传后会自动提取内容并向量化存入知识库
    
    参数:
    - overwrite: 是否覆盖已存在的同名文件 (默认: false)
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以上传文档")
    
    # 验证课程是否存在且属于当前教师
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.teacher_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权限")
    
    # 验证文件类型
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件类型。支持的格式: {', '.join(ALLOWED_EXTENSIONS.keys())}"
        )
    
    # 检查是否已存在同名文件
    existing_doc = db.execute(
        text("""
            SELECT id, file_name, created_at
            FROM course_documents
            WHERE course_id = :course_id AND file_name = :file_name
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {
            "course_id": str(course_id),
            "file_name": file.filename
        }
    ).fetchone()
    
    if existing_doc and not overwrite:
        # 文件已存在且不覆盖，返回错误提示前端
        raise HTTPException(
            status_code=409,  # Conflict
            detail={
                "error": "file_exists",
                "message": f"文件 '{file.filename}' 已存在",
                "existing_file": {
                    "id": str(existing_doc[0]),
                    "file_name": existing_doc[1],
                    "uploaded_at": str(existing_doc[2])
                }
            }
        )
    
    # 读取文件内容以检查大小
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"文件大小超过限制（最大 {MAX_FILE_SIZE // (1024*1024)}MB）"
        )
    
    file_path = None
    document_id = None
    
    try:
        # 如果是覆盖模式，先删除旧文件和数据
        if existing_doc and overwrite:
            old_doc_id = existing_doc[0]
            print(f"🔄 覆盖模式: 删除旧文档 {file.filename} (ID: {old_doc_id})")
            
            # 删除向量数据库中的数据
            try:
                vector_db = get_vector_db()
                results = vector_db.course_collection.get(
                    where={"document_id": str(old_doc_id)}
                )
                if results and results['ids']:
                    vector_db.course_collection.delete(ids=results['ids'])
                    print(f"   ✅ 删除 {len(results['ids'])} 个向量")
            except Exception as e:
                print(f"   ⚠️  删除向量失败: {e}")
            
            # 删除PostgreSQL中的数据
            db.execute(
                text("DELETE FROM knowledge_base WHERE document_id = :doc_id"),
                {"doc_id": str(old_doc_id)}
            )
            db.execute(
                text("DELETE FROM course_documents WHERE id = :doc_id"),
                {"doc_id": str(old_doc_id)}
            )
            db.commit()
            print(f"   ✅ 删除旧数据完成")
        
        # 创建上传目录
        backend_dir = Path(__file__).resolve().parent.parent.parent
        upload_dir = backend_dir / "static" / "course_documents" / str(course_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成唯一文件名
        import time
        timestamp = int(time.time() * 1000)
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = upload_dir / safe_filename
        
        # 保存文件
        with file_path.open("wb") as buffer:
            buffer.write(file_content)
        
        # 记录到数据库
        result = db.execute(
            text("""
                INSERT INTO course_documents 
                (course_id, teacher_id, file_name, file_path, file_type, file_size, upload_status, processed_status)
                VALUES (:course_id, :teacher_id, :file_name, :file_path, :file_type, :file_size, :upload_status, :processed_status)
                RETURNING id, created_at
            """),
            {
                "course_id": str(course_id),
                "teacher_id": str(current_user.id),
                "file_name": file.filename,
                "file_path": str(file_path),
                "file_type": file_ext,
                "file_size": file_size,
                "upload_status": "completed",
                "processed_status": "processing"
            }
        )
        db.commit()
        
        row = result.fetchone()
        doc_id = str(row[0])
        created_at = row[1]
        
        # 在后台处理文档：提取文本并向量化
        print(f"📤 文档上传成功，开始后台处理: {file.filename}")
        background_tasks.add_task(
            process_document_background,
            document_id=doc_id,
            course_id=str(course_id),
            file_path=str(file_path),
            file_name=file.filename,
            file_type=file_ext,
            db=db
        )
        
        return {
            "id": doc_id,
            "message": "文档上传成功，正在后台处理中...",
            "file_name": file.filename,
            "file_size": file_size,
            "course_name": course.course_name,
            "created_at": str(created_at),
            "status": "processing"
        }
        
    except Exception as e:
        db.rollback()
        # 如果数据库操作失败，删除已上传的文件
        if file_path and file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"上传文件失败: {str(e)}")

@router.get("/courses/{course_id}/documents", response_model=CourseDocumentsResponse)
async def get_course_documents(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取指定课程的所有文档"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以查看文档")
    
    # 验证课程是否存在且属于当前教师
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.teacher_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权限")
    
    # 查询文档
    result = db.execute(
        text("""
            SELECT id, course_id, file_name, file_type, file_size, 
                   upload_status, processed_status, error_message, created_at
            FROM course_documents
            WHERE course_id = :course_id
            ORDER BY created_at DESC
        """),
        {"course_id": str(course_id)}
    )
    
    documents = []
    for row in result:
        documents.append(DocumentResponse(
            id=str(row[0]),
            course_id=str(row[1]),
            course_name=course.course_name,
            file_name=row[2],
            file_type=row[3],
            file_size=row[4],
            upload_status=row[5],
            processed_status=row[6],
            error_message=row[7],
            created_at=str(row[8])
        ))
    
    return CourseDocumentsResponse(
        course_id=str(course_id),
        course_name=course.course_name,
        document_count=len(documents),
        documents=documents
    )

@router.get("/courses/{course_id}/check-file/{filename}")
async def check_file_exists(
    course_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    检查指定课程中是否已存在同名文件
    用于上传前的重复检测
    """
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以检查文件")
    
    # 验证课程权限
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.teacher_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权限")
    
    # 查询是否存在同名文件
    existing = db.execute(
        text("""
            SELECT id, file_name, file_size, created_at, processed_status
            FROM course_documents
            WHERE course_id = :course_id AND file_name = :file_name
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {
            "course_id": str(course_id),
            "file_name": filename
        }
    ).fetchone()
    
    if existing:
        return {
            "exists": True,
            "file": {
                "id": str(existing[0]),
                "file_name": existing[1],
                "file_size": existing[2],
                "uploaded_at": str(existing[3]),
                "status": existing[4]
            }
        }
    else:
        return {"exists": False}

@router.get("/knowledge-base/stats", response_model=KnowledgeBaseStats)
async def get_knowledge_base_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取教师的知识库统计信息（总知识库）"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以查看知识库统计")
    
    # 查询该教师所有课程的文档数量
    result = db.execute(
        text("""
            SELECT 
                c.id as course_id,
                c.course_name,
                COUNT(cd.id) as doc_count,
                SUM(cd.file_size) as total_size
            FROM courses c
            LEFT JOIN course_documents cd ON c.id = cd.course_id
            WHERE c.teacher_id = :teacher_id AND c.status = 'active'
            GROUP BY c.id, c.course_name
            ORDER BY doc_count DESC
        """),
        {"teacher_id": str(current_user.id)}
    )
    
    documents_by_course = []
    total_documents = 0
    courses_with_docs = 0
    
    for row in result:
        doc_count = row[2] or 0
        total_size = row[3] or 0
        
        if doc_count > 0:
            courses_with_docs += 1
            total_documents += doc_count
        
        documents_by_course.append({
            "course_id": str(row[0]),
            "course_name": row[1],
            "document_count": doc_count,
            "total_size": total_size
        })
    
    return KnowledgeBaseStats(
        total_documents=total_documents,
        total_courses_with_docs=courses_with_docs,
        documents_by_course=documents_by_course
    )

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除文档"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以删除文档")
    
    # 查询文档
    result = db.execute(
        text("""
            SELECT cd.file_path, c.teacher_id
            FROM course_documents cd
            JOIN courses c ON cd.course_id = c.id
            WHERE cd.id = :document_id
        """),
        {"document_id": str(document_id)}
    )
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    file_path, teacher_id = row[0], row[1]
    
    # 验证权限
    if str(teacher_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="无权限删除此文档")
    
    try:
        # 删除物理文件
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # 删除数据库记录（会级联删除knowledge_base中的相关记录）
        db.execute(
            text("DELETE FROM course_documents WHERE id = :document_id"),
            {"document_id": str(document_id)}
        )
        db.commit()
        
        return {"message": "文档删除成功"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除文档失败: {str(e)}")
