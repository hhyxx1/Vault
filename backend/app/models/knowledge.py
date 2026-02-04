from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, DECIMAL, ARRAY, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class CourseDocument(Base):
    """课程文档模型"""
    __tablename__ = "course_documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    document_type = Column(String(50), default='material')  # 'outline' 或 'material'
    upload_status = Column(String(20), default='processing')
    processed_status = Column(String(20), default='pending')
    processing_progress = Column(Integer, default=0)  # 0-100
    extracted_text = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnowledgePoint(Base):
    """知识点模型"""
    __tablename__ = "knowledge_points"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("course_documents.id", ondelete="SET NULL"))
    point_name = Column(String(500), nullable=False)
    point_content = Column(Text)
    point_type = Column(String(50), default='concept')
    level = Column(Integer, default=1)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_points.id", ondelete="SET NULL"))
    keywords = Column(ARRAY(Text))
    difficulty = Column(String(20), default='medium')
    importance = Column(Integer, default=3)
    order_index = Column(Integer, default=0)
    extra_info = Column(JSONB)  # 重命名为extra_info避免与SQLAlchemy保留字冲突
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnowledgeRelation(Base):
    """知识点关系模型"""
    __tablename__ = "knowledge_relations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    source_point_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False)
    target_point_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(50), nullable=False)
    relation_strength = Column(DECIMAL(3, 2), default=0.5)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentProcessingTask(Base):
    """文档处理任务模型"""
    __tablename__ = "document_processing_tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("course_documents.id", ondelete="CASCADE"), nullable=False)
    task_type = Column(String(50), nullable=False)
    status = Column(String(20), default='pending')
    progress = Column(Integer, default=0)
    total_steps = Column(Integer, default=1)
    current_step = Column(Integer, default=0)
    result_data = Column(JSONB)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnowledgeGraph(Base):
    """知识图谱元数据模型"""
    __tablename__ = "knowledge_graphs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), unique=True, nullable=False)
    graph_name = Column(String(200))
    total_points = Column(Integer, default=0)
    total_relations = Column(Integer, default=0)
    graph_depth = Column(Integer, default=0)
    graph_data = Column(JSONB)
    statistics = Column(JSONB)
    last_updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
