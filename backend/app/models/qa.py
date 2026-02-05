from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class QARecord(Base):
    """问答记录模型"""
    __tablename__ = "qa_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # 移除外键约束
    course_id = Column(UUID(as_uuid=True), index=True)  # 移除外键约束，因为courses表可能不存在
    session_id = Column(UUID(as_uuid=True), index=True)  # 会话ID（改为UUID类型以匹配数据库）
    question = Column(Text, nullable=False)
    answer = Column(Text)
    answer_type = Column(String(50), default='ai')  # 'ai' or 'knowledge_base'
    intent = Column(String(50))  # 用户意图类型
    skill_used = Column(String(200))  # 使用的Skill名称
    context_used = Column(JSONB)  # 使用的上下文信息
    knowledge_sources = Column(JSONB)  # 引用的知识库来源
    confidence_score = Column(DECIMAL(3, 2))  # 置信度分数（0-1）
    is_helpful = Column(Boolean)  # 学生反馈
    feedback = Column(Text)  # 学生反馈内容
    response_time = Column(Integer)  # 响应时间（毫秒）
    tokens_used = Column(Integer)  # 使用的token数量
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class QASession(Base):
    """问答会话模型"""
    __tablename__ = "qa_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # 移除外键约束
    title = Column(String(200))
    course_id = Column(UUID(as_uuid=True))  # 移除外键约束
    message_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, index=True)
    last_message_at = Column(DateTime)


class QAShare(Base):
    """对话分享模型"""
    __tablename__ = "qa_shares"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    share_code = Column(String(10), unique=True, nullable=False, index=True)  # 6位分享码
    session_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # 关联的会话ID（改为UUID类型）
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # 移除外键约束
    title = Column(String(200))  # 分享标题
    messages = Column(JSONB, nullable=False)  # 对话消息内容
    view_count = Column(Integer, default=0)  # 查看次数
    is_active = Column(Boolean, default=True)  # 是否有效
    expires_at = Column(DateTime)  # 过期时间（可选）
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
