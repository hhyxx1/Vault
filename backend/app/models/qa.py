from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class QARecord(Base):
    """问答记录模型"""
    __tablename__ = "qa_records"
    
    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"))
    question = Column(Text)
    answer = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
