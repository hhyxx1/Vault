from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class QARecord(Base):
    """问答记录模型"""
    __tablename__ = "qa_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text)
    answer_type = Column(String(50))  # 'ai' or 'knowledge_base'
    context_used = Column(JSONB)  # 使用的上下文信息
    knowledge_sources = Column(JSONB)  # 引用的知识库来源
    confidence_score = Column(DECIMAL(3, 2))  # 置信度分数（0-1）
    is_helpful = Column(Boolean)  # 学生反馈
    feedback = Column(Text)  # 学生反馈内容
    response_time = Column(Integer)  # 响应时间（毫秒）
    tokens_used = Column(Integer)  # 使用的token数量
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

class QASession(Base):
    """问答会话模型"""
    __tablename__ = "qa_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200))
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"))
    message_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, index=True)
    last_message_at = Column(DateTime)
