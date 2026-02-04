from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, DECIMAL, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default='student', index=True)
    full_name = Column(String(100))
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime)

    # 关系
    student = relationship("Student", back_populates="user", uselist=False)
    teacher = relationship("Teacher", back_populates="user", uselist=False)

class Student(Base):
    """学生模型"""
    __tablename__ = "students"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    student_number = Column(String(50), unique=True, nullable=False, index=True)
    major = Column(String(100))
    grade = Column(String(20))
    class_name = Column(String(50))
    total_questions = Column(Integer, default=0, nullable=False)
    total_scores = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关系
    user = relationship("User", back_populates="student")

class Teacher(Base):
    """教师模型"""
    __tablename__ = "teachers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    teacher_number = Column(String(50), unique=True, nullable=False, index=True)
    department = Column(String(100), index=True)
    title = Column(String(50))
    courses = Column(JSONB)  # 授课课程列表
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关系
    user = relationship("User", back_populates="teacher")
