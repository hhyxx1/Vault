from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Course(Base):
    """课程模型"""
    __tablename__ = "courses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    course_code = Column(String(50), unique=True, nullable=False, index=True)
    course_name = Column(String(200), nullable=False)
    description = Column(Text)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    semester = Column(String(50))
    credit = Column(DECIMAL(3, 1))
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Class(Base):
    """班级模型"""
    __tablename__ = "classes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    class_name = Column(String(100), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    max_students = Column(Integer, default=100)
    academic_year = Column(String(20))
    invite_code = Column(String(20), unique=True, index=True)
    allow_self_enroll = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
