from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Survey(Base):
    """问卷模型"""
    __tablename__ = "surveys"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    teacher_id = Column(String, ForeignKey("users.id"))
    status = Column(String)  # 'draft', 'active', 'closed'
    questions = Column(JSON)  # 存储问题列表
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SurveyResponse(Base):
    """问卷回答模型"""
    __tablename__ = "survey_responses"
    
    id = Column(String, primary_key=True, index=True)
    survey_id = Column(String, ForeignKey("surveys.id"))
    student_id = Column(String, ForeignKey("users.id"))
    answers = Column(JSON)  # 存储答案
    submitted_at = Column(DateTime, default=datetime.utcnow)
