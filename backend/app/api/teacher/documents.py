#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
教师文档管理API
支持上传课程大纲和课程资料，自动提取知识点并构建知识图谱
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import os
import uuid
import aiofiles

from app.database import get_db
from app.models.user import User
from app.models.course import Course, KnowledgeBase
from app.models.knowledge import CourseDocument, DocumentProcessingTask, KnowledgePoint, KnowledgeGraph
from app.api.auth import get_current_user
from app.services.knowledge_extractor import KnowledgePointExtractor

router = APIRouter()

# 文件上传配置 - 动态获取项目路径
def get_upload_base_dir() -> Path:
    """获取上传文件的基础目录 (backend/app/api/static/course_documents)"""
    current_file = Path(__file__).resolve()  # documents.py 的路径
    api_dir = current_file.parent.parent  # backend/app/api
    static_dir = api_dir / "static" / "course_documents"
    static_dir.mkdir(parents=True, exist_ok=True)
    return static_dir

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt', '.ppt', '.pptx'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


async def save_upload_file(upload_file: UploadFile, course_id: str, document_type: str) -> tuple[str, int]:
    """
    保存上传的文件
    
    文件结构：
    - backend/app/static/course_documents/{course_id}/outline/  - 课程大纲
    - backend/app/static/course_documents/{course_id}/material/ - 课程资料
    """
    # 获取动态基础目录
    base_dir = get_upload_base_dir()
    
    # 根据文档类型确定保存目录
    course_dir = base_dir / course_id / document_type
    course_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成唯一文件名
    file_ext = os.path.splitext(upload_file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = course_dir / unique_filename
    
    # 异步保存文件
    file_size = 0
    async with aiofiles.open(str(file_path), 'wb') as f:
        while chunk := await upload_file.read(1024 * 1024):  # 1MB chunks
            await f.write(chunk)
            file_size += len(chunk)
    
    return str(file_path), file_size


@router.post("/courses/{course_id}/documents/upload")
async def upload_course_document(
    course_id: str,
    document_type: str = Form(...),  # 'outline' 或 'material'
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    上传课程文档（大纲或资料）
    
    - **course_id**: 课程ID
    - **document_type**: 文档类型 ('outline': 课程大纲, 'material': 课程资料)
    - **file**: 上传的文件
    
    支持的文件格式：PDF, Word (docx/doc), TXT, PPT
    """
    # 验证文档类型
    if document_type not in ['outline', 'material']:
        raise HTTPException(status_code=400, detail="文档类型必须是 'outline' 或 'material'")
    
    # 验证文件类型
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。支持的格式: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 验证课程是否存在且用户有权限
    course = db.execute(
        select(Course).where(
            and_(
                Course.id == course_id,
                Course.teacher_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权访问")
    
    # 检查是否存在同名文件（同课程、同文件名）
    existing_doc = db.execute(
        select(CourseDocument).where(
            and_(
                CourseDocument.course_id == course_id,
                CourseDocument.file_name == file.filename,
                CourseDocument.document_type == document_type
            )
        )
    ).scalar_one_or_none()
    
    try:
        # 如果存在重复文件，先删除旧的数据
        if existing_doc:
            print(f"🔄 检测到重复文件: {file.filename}，正在替换...")
            
            # 1. 删除旧的本地文件
            if os.path.exists(existing_doc.file_path):
                try:
                    os.remove(existing_doc.file_path)
                    print(f"  ✓ 已删除旧文件: {existing_doc.file_path}")
                except Exception as e:
                    print(f"  ⚠ 删除旧文件失败: {e}")
            
            # 2. 删除向量数据库中的记录
            try:
                vector_records = db.execute(
                    select(KnowledgeBase).where(KnowledgeBase.document_id == existing_doc.id)
                ).scalars().all()
                
                for record in vector_records:
                    db.delete(record)
                print(f"  ✓ 已删除向量数据库记录: {len(vector_records)} 条")
            except Exception as e:
                print(f"  ⚠ 删除向量数据库记录失败: {e}")
            
            # 3. 删除知识点和关系（会级联删除）
            try:
                knowledge_points = db.execute(
                    select(KnowledgePoint).where(KnowledgePoint.document_id == existing_doc.id)
                ).scalars().all()
                print(f"  ✓ 将级联删除知识点: {len(knowledge_points)} 个")
            except Exception as e:
                print(f"  ⚠ 统计知识点失败: {e}")
            
            # 4. 删除数据库记录（级联删除相关数据）
            db.delete(existing_doc)
            db.commit()
            print(f"  ✓ 已删除数据库记录")
        
        # 保存新文件到对应的文件夹（大纲或资料）
        file_path, file_size = await save_upload_file(file, course_id, document_type)
        print(f"✓ 新文件已保存: {file_path}")
        
        # 创建文档记录
        document = CourseDocument(
            id=uuid.uuid4(),
            course_id=course_id,
            teacher_id=current_user.id,
            file_name=file.filename,
            file_path=file_path,
            file_type=file_ext[1:],  # 去掉点号
            file_size=file_size,
            document_type=document_type,
            upload_status='completed',
            processed_status='pending',
            processing_progress=0
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # 在后台启动知识点提取任务
        if background_tasks:
            background_tasks.add_task(
                process_document_background,
                str(document.id),
                str(course_id),
                file_path,
                file_ext[1:],
                db
            )
        
        return {
            "message": "文档上传成功，正在后台处理",
            "document_id": str(document.id),
            "document_type": document_type,
            "file_name": file.filename,
            "file_size": file_size,
            "processing_status": "pending"
        }
        
    except Exception as e:
        # 如果出错，删除已上传的文件
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


async def process_document_background(
    document_id: str,
    course_id: str,
    file_path: str,
    file_type: str,
    db: Session
):
    """后台处理文档的知识点提取"""
    try:
        extractor = KnowledgePointExtractor(db)
        await extractor.process_document_async(
            document_id=document_id,
            course_id=course_id,
            file_path=file_path,
            file_type=file_type
        )
    except Exception as e:
        # 更新文档状态为失败
        document = db.get(CourseDocument, document_id)
        if document:
            document.processed_status = 'failed'
            document.error_message = str(e)
            db.commit()


@router.get("/courses/{course_id}/documents")
async def get_course_documents(
    course_id: str,
    document_type: Optional[str] = None,  # 可选过滤：'outline' 或 'material'
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取课程的所有文档
    
    - **course_id**: 课程ID
    - **document_type**: 可选，过滤文档类型
    """
    # 验证课程权限
    course = db.execute(
        select(Course).where(
            and_(
                Course.id == course_id,
                Course.teacher_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权访问")
    
    # 查询文档
    query = select(CourseDocument).where(CourseDocument.course_id == course_id)
    if document_type:
        query = query.where(CourseDocument.document_type == document_type)
    
    documents = db.execute(query.order_by(CourseDocument.created_at.desc())).scalars().all()
    
    return {
        "course_id": course_id,
        "course_name": course.course_name,
        "total_documents": len(documents),
        "documents": [
            {
                "id": str(doc.id),
                "file_name": doc.file_name,
                "document_type": doc.document_type,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "processing_status": doc.processed_status,
                "processing_progress": doc.processing_progress,
                "uploaded_at": doc.created_at.isoformat() if doc.created_at else None,
                "error_message": doc.error_message
            }
            for doc in documents
        ]
    }


@router.get("/documents/{document_id}/progress")
async def get_document_processing_progress(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取文档处理进度
    
    返回实时的处理进度（0-100%）和当前步骤
    """
    # 获取文档
    document = db.get(CourseDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 通过课程验证权限
    course = db.get(Course, document.course_id)
    if not course or str(course.teacher_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="无权访问此文档")
    
    # 获取处理任务
    task = db.execute(
        select(DocumentProcessingTask)
        .where(DocumentProcessingTask.document_id == document_id)
        .order_by(DocumentProcessingTask.started_at.desc())
    ).scalar_one_or_none()
    
    if not task:
        return {
            "document_id": document_id,
            "status": document.processed_status,
            "progress": document.processing_progress,
            "current_step": None,
            "total_steps": 6,
            "message": "暂无处理任务"
        }
    
    return {
        "document_id": document_id,
        "task_id": str(task.id),
        "status": task.status,
        "progress": task.progress,
        "current_step": task.current_step,
        "total_steps": task.total_steps,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "error_message": task.error_message,
        "result_summary": task.result_data
    }


@router.get("/courses/{course_id}/knowledge-graph")
async def get_course_knowledge_graph(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取课程的知识图谱
    
    返回所有知识点和它们之间的关系，用于可视化
    """
    # 验证课程权限
    course = db.execute(
        select(Course).where(
            and_(
                Course.id == course_id,
                Course.teacher_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权访问")
    
    # 获取知识图谱
    graph = db.execute(
        select(KnowledgeGraph)
        .where(KnowledgeGraph.course_id == course_id)
        .order_by(KnowledgeGraph.updated_at.desc())
    ).scalar_one_or_none()
    
    if not graph:
        # 如果没有图谱，返回空数据
        return {
            "course_id": course_id,
            "nodes": [],
            "edges": [],
            "statistics": {
                "total_nodes": 0,
                "total_edges": 0
            }
        }
    
    # 获取所有知识点
    knowledge_points = db.execute(
        select(KnowledgePoint)
        .where(KnowledgePoint.course_id == course_id)
        .order_by(KnowledgePoint.order_index)
    ).scalars().all()
    
    # 构建节点和边数据
    nodes = [
        {
            "id": str(kp.id),
            "label": kp.point_name,
            "type": kp.point_type,
            "level": kp.level,
            "difficulty": kp.difficulty,
            "importance": kp.importance,
            "keywords": kp.keywords or []
        }
        for kp in knowledge_points
    ]
    
    # 从图谱数据中提取边
    edges = graph.graph_data.get('edges', []) if graph.graph_data else []
    
    return {
        "course_id": course_id,
        "course_name": course.course_name,
        "nodes": nodes,
        "edges": edges,
        "statistics": graph.statistics or {
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        },
        "updated_at": graph.updated_at.isoformat() if graph.updated_at else None
    }


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除文档及其相关数据
    
    完整清理三个位置的数据：
    1. PostgreSQL数据库（文档记录、知识点、关系、任务等）
    2. 向量数据库（knowledge_base表中的文档片段）
    3. 本地文件系统（上传的原始文件）
    """
    # 获取文档
    document = db.get(CourseDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 通过课程验证权限
    course = db.get(Course, document.course_id)
    if not course or str(course.teacher_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="无权删除此文档")
    
    deleted_items = {
        "local_file": False,
        "vector_db": 0,
        "knowledge_points": 0,
        "database_record": False
    }
    
    try:
        # 1. 删除本地文件
        if os.path.exists(document.file_path):
            try:
                os.remove(document.file_path)
                deleted_items["local_file"] = True
                print(f"✓ 已删除本地文件: {document.file_path}")
            except Exception as e:
                print(f"✗ 删除本地文件失败: {e}")
        else:
            print(f"⚠ 本地文件不存在: {document.file_path}")
        
        # 2. 删除向量数据库中的记录（knowledge_base表）
        try:
            vector_result = db.execute(
                select(KnowledgeBase).where(KnowledgeBase.document_id == document_id)
            ).scalars().all()
            
            vector_count = len(vector_result)
            if vector_count > 0:
                for kb_record in vector_result:
                    db.delete(kb_record)
                deleted_items["vector_db"] = vector_count
                print(f"✓ 已删除向量数据库记录: {vector_count} 条")
            else:
                print("⚠ 向量数据库中无相关记录")
        except Exception as e:
            print(f"✗ 删除向量数据库记录失败: {e}")
        
        # 3. 统计将被级联删除的知识点数量
        try:
            kp_result = db.execute(
                select(KnowledgePoint).where(KnowledgePoint.document_id == document_id)
            ).scalars().all()
            deleted_items["knowledge_points"] = len(kp_result)
            if deleted_items["knowledge_points"] > 0:
                print(f"✓ 将级联删除知识点: {deleted_items['knowledge_points']} 个")
        except Exception as e:
            print(f"⚠ 统计知识点失败: {e}")
        
        # 4. 删除PostgreSQL数据库记录
        # 级联删除：
        # - document_processing_tasks (文档处理任务)
        # - knowledge_points (知识点)
        # - knowledge_relations (知识点关系，通过knowledge_points级联)
        db.delete(document)
        db.commit()
        deleted_items["database_record"] = True
        print(f"✓ 已删除数据库记录及级联数据")
        
        return {
            "message": "文档删除成功",
            "deleted_items": deleted_items,
            "details": {
                "document_id": document_id,
                "file_name": document.file_name,
                "local_file_deleted": deleted_items["local_file"],
                "vector_records_deleted": deleted_items["vector_db"],
                "knowledge_points_deleted": deleted_items["knowledge_points"],
                "database_record_deleted": deleted_items["database_record"]
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"删除失败: {str(e)}"
        )
