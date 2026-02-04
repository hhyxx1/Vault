from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Survey(Base):
    """问卷模型"""
    __tablename__ = "surveys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"))
    survey_type = Column(String(50), nullable=False, default='questionnaire')  # 'questionnaire' or 'exam'
    # 发布类型：in_class=课堂检测, homework=课后作业, practice=自主练习
    release_type = Column(String(30), nullable=False, default='in_class', index=True)
    # 发布目标班级ID列表（支持多班级）；为空时兼容旧数据可用 class_id
    target_class_ids = Column(JSONB)  # List[str] of UUID
    target_students = Column(JSONB)  # 目标学生ID列表
    generation_method = Column(String(50), nullable=False, default='manual')
    generation_prompt = Column(Text)
    status = Column(String(20), nullable=False, default='draft', index=True)
    total_score = Column(Integer, default=100)
    pass_score = Column(Integer, default=60)
    time_limit = Column(Integer)  # 分钟
    allow_multiple_attempts = Column(Boolean, default=False, nullable=False)
    max_attempts = Column(Integer, default=1)
    show_answer = Column(Boolean, default=False, nullable=False)
    shuffle_questions = Column(Boolean, default=False, nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime)

    # 关系
    questions = relationship("Question", back_populates="survey", cascade="all, delete-orphan")

class Question(Base):
    """题目模型"""
    __tablename__ = "questions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete='CASCADE'), nullable=False, index=True)
    question_type = Column(String(50), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_order = Column(Integer, nullable=False)
    score = Column(DECIMAL(10, 2), nullable=False, default=0)
    difficulty = Column(String(20), default='medium')
    options = Column(JSONB)  # 选项
    correct_answer = Column(JSONB)  # 正确答案
    answer_explanation = Column(Text)
    tags = Column(ARRAY(Text))
    knowledge_points = Column(ARRAY(Text))
    is_required = Column(Boolean, default=True, nullable=False)
    # 问答题专用字段
    reference_files = Column(JSONB)  # 参考材料文件URL列表
    min_word_count = Column(Integer)  # 最小作答字数
    grading_criteria = Column(JSONB)  # 评分标准
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关系
    survey = relationship("Survey", back_populates="questions")

class SurveyResponse(Base):
    """问卷回答模型"""
    __tablename__ = "survey_responses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    total_score = Column(DECIMAL(5, 2))
    percentage_score = Column(DECIMAL(5, 2))
    is_passed = Column(Boolean)
    status = Column(String(20), nullable=False, default='in_progress', index=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    submit_time = Column(DateTime)
    time_spent = Column(Integer)  # 秒
    ip_address = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关系
    answers = relationship("Answer", back_populates="response", cascade="all, delete-orphan")

class Answer(Base):
    """答案模型"""
    __tablename__ = "answers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    response_id = Column(UUID(as_uuid=True), ForeignKey("survey_responses.id", ondelete='CASCADE'), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, index=True)
    student_answer = Column(JSONB)
    is_correct = Column(Boolean)
    score = Column(DECIMAL(5, 2), default=0)
    teacher_comment = Column(Text)
    auto_graded = Column(Boolean, default=False, nullable=False)
    graded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    graded_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关系
    response = relationship("SurveyResponse", back_populates="answers")

class QuestionnaireSubmission(Base):
    """问卷提交记录模型"""
    __tablename__ = "questionnaire_submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete='CASCADE'), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete='CASCADE'), nullable=False, index=True)
    total_score = Column(DECIMAL(10, 2))
    time_spent = Column(Integer, nullable=False, default=0)  # 秒
    submit_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
