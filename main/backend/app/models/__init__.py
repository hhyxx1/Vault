# 数据模型模块

from .user import User, Student, Teacher
from .qa import QARecord
from .survey import Survey, Question
from .course import Course, Class, class_courses
from .knowledge import CourseDocument, KnowledgePoint, KnowledgeRelation, DocumentProcessingTask, KnowledgeGraph

__all__ = [
    "User",
    "Student", 
    "Teacher",
    "QARecord",
    "Survey",
    "Question",
    "Course",
    "Class",
    "class_courses",
    "CourseDocument",
    "KnowledgePoint",
    "KnowledgeRelation",
    "DocumentProcessingTask",
    "KnowledgeGraph"
]
