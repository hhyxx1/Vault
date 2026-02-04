from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID
import random
import string
import shutil
import os
import time
from pathlib import Path

from app.database import get_db
from app.models.user import User
from app.models.course import Course, Class
from app.utils.auth import get_current_user
from pydantic import BaseModel, Field

router = APIRouter()

# Pydantic schemas
class TeacherProfileResponse(BaseModel):
    id: str
    username: str
    full_name: str
    email: str
    avatar_url: str | None
    teacher_number: str
    department: str | None
    title: str | None
    join_date: str | None

    class Config:
        from_attributes = True

class TeacherProfileUpdate(BaseModel):
    full_name: str = Field(..., description="真实姓名")
    email: str = Field(..., description="电子邮箱")
    department: str = Field(..., description="所属院系")
    title: str = Field(..., description="职称")

@router.get("/", response_model=TeacherProfileResponse)
async def get_teacher_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取教师个人资料"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 从数据库查询完整的用户信息
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    teacher = db_user.teacher
    if not teacher:
        raise HTTPException(status_code=404, detail="未找到教师信息")
        
    return TeacherProfileResponse(
        id=str(db_user.id),
        username=db_user.username,
        full_name=db_user.full_name or db_user.username,
        email=db_user.email,
        avatar_url=db_user.avatar_url,
        teacher_number=teacher.teacher_number,
        department=teacher.department,
        title=teacher.title,
        join_date=teacher.created_at.strftime("%Y-%m-%d") if teacher.created_at else None
    )

@router.put("/", response_model=TeacherProfileResponse)
async def update_teacher_profile(
    profile_data: TeacherProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新教师个人资料"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 从数据库查询完整的用户信息
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    teacher = db_user.teacher
    if not teacher:
        raise HTTPException(status_code=404, detail="未找到教师信息")
    
    # 检查邮箱是否被其他用户使用
    if profile_data.email != db_user.email:
        existing_user = db.query(User).filter(
            User.email == profile_data.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="该邮箱已被使用")
    
    # 更新 User 表
    db_user.full_name = profile_data.full_name
    db_user.email = profile_data.email
    
    # 更新 Teacher 表
    teacher.department = profile_data.department
    teacher.title = profile_data.title
    
    db.commit()
    db.refresh(db_user)
    db.refresh(teacher)
    
    return TeacherProfileResponse(
        id=str(db_user.id),
        username=db_user.username,
        full_name=db_user.full_name,
        email=db_user.email,
        avatar_url=db_user.avatar_url,
        teacher_number=teacher.teacher_number,
        department=teacher.department,
        title=teacher.title,
        join_date=teacher.created_at.strftime("%Y-%m-%d") if teacher.created_at else None
    )

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传头像"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以上传头像")
        
    # 验证文件类型
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="只能上传图片文件")
        
    try:
        # 保存文件 - 使用绝对路径
        # 获取backend目录的绝对路径
        backend_dir = Path(__file__).resolve().parent.parent.parent
        upload_dir = backend_dir / "app" / "static" / "avatars"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Upload directory: {upload_dir}")
        print(f"File: {file.filename}, Content-Type: {file.content_type}")
        
        # 生成文件名 - 使用用户ID作为文件名
        file_ext = os.path.splitext(file.filename)[1].lower()
        if not file_ext or file_ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            file_ext = ".jpg"  # 默认扩展名
            
        # 删除该用户已有的所有头像文件（覆盖旧头像）
        try:
            for existing_file in upload_dir.iterdir():
                if existing_file.is_file() and existing_file.stem == str(current_user.id):
                    print(f"Deleting old avatar: {existing_file}")
                    os.remove(existing_file)
        except Exception as e:
            print(f"Error deleting old avatar: {e}")

        filename = f"{current_user.id}{file_ext}"
        file_path = upload_dir / filename
        
        print(f"Saving avatar to: {file_path}")
        
        # 保存文件
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"Avatar saved successfully: {file_path.exists()}")
            
        # 更新用户头像URL - 从数据库查询完整的用户对象
        db_user = db.query(User).filter(User.id == current_user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        base_url = f"http://localhost:8000/static/avatars/{filename}"
        db_user.avatar_url = base_url
        db.commit()
        db.refresh(db_user)
        
        print(f"Database updated: avatar_url = {base_url}")
        
        return {"avatar_url": base_url}
    except Exception as e:
        print(f"Error uploading avatar: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"上传头像失败: {str(e)}")

class CourseCreate(BaseModel):
    course_code: str = Field(..., description="课程代码")
    course_name: str = Field(..., description="课程名称")
    description: str | None = Field(None, description="课程描述")
    semester: str = Field(..., description="学期")
    credit: float = Field(..., description="学分")

class CourseResponse(BaseModel):
    id: str
    course_code: str
    course_name: str
    description: str | None
    semester: str
    credit: float
    status: str
    
    class Config:
        from_attributes = True

class ClassCreate(BaseModel):
    class_name: str = Field(..., description="班级名称")
    course_id: str | None = Field(None, description="课程ID（单个，兼容旧版）")
    course_ids: List[str] | None = Field(None, description="课程ID列表（多个）")
    max_students: int = Field(100, description="最大学生数")
    academic_year: str = Field(..., description="学年")
    allow_self_enroll: bool = Field(False, description="是否允许自主加入")

class ClassResponse(BaseModel):
    id: str
    class_name: str
    course_id: str
    course_name: str
    max_students: int
    academic_year: str
    invite_code: str
    allow_self_enroll: bool
    status: str
    student_count: int
    average_score: float | None = None
    course_ids: List[str] | None = None  # 新增：关联的所有课程ID列表
    
    class Config:
        from_attributes = True

def generate_invite_code() -> str:
    """生成随机邀请码"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@router.get("/courses", response_model=List[CourseResponse])
async def get_teacher_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取教师的所有课程"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    courses = db.query(Course).filter(
        Course.teacher_id == current_user.id,
        Course.status == 'active'
    ).all()
    
    return [
        CourseResponse(
            id=str(course.id),
            course_code=course.course_code,
            course_name=course.course_name,
            description=course.description,
            semester=course.semester,
            credit=float(course.credit),
            status=course.status
        )
        for course in courses
    ]

@router.post("/courses", response_model=CourseResponse)
async def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新课程"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以创建课程")
    
    # 检查课程代码是否已存在
    existing_course = db.query(Course).filter(
        Course.course_code == course_data.course_code
    ).first()
    if existing_course:
        raise HTTPException(status_code=400, detail="课程代码已存在")
    
    new_course = Course(
        course_code=course_data.course_code,
        course_name=course_data.course_name,
        description=course_data.description,
        teacher_id=current_user.id,
        semester=course_data.semester,
        credit=course_data.credit,
        status='active'
    )
    
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    
    return CourseResponse(
        id=str(new_course.id),
        course_code=new_course.course_code,
        course_name=new_course.course_name,
        description=new_course.description,
        semester=new_course.semester,
        credit=float(new_course.credit),
        status=new_course.status
    )

@router.get("/classes", response_model=List[ClassResponse])
async def get_teacher_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取教师的所有班级"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 简化查询
    classes_list = db.query(Class).filter(
        Class.teacher_id == current_user.id,
        Class.status == 'active'
    ).all()
    
    result = []
    for cls in classes_list:
        # 获取学生数量和平均成绩
        from sqlalchemy import text
        try:
            student_count_result = db.execute(
                text("SELECT COUNT(*) FROM class_students WHERE class_id = :class_id AND status = 'active'"),
                {"class_id": str(cls.id)}
            ).scalar()
        except:
            # 如果查询失败，默认为0
            student_count_result = 0
        
        # 计算班级平均成绩（基于该班级学生在该课程相关问卷中的成绩）
        average_score = None
        try:
            avg_result = db.execute(
                text("""
                    SELECT AVG(sr.total_score) 
                    FROM survey_responses sr
                    INNER JOIN surveys s ON sr.survey_id = s.id
                    INNER JOIN class_students cs ON sr.student_id = cs.student_id
                    WHERE cs.class_id = :class_id 
                    AND cs.status = 'active'
                    AND s.class_id = :class_id
                    AND sr.status = 'completed'
                """),
                {"class_id": str(cls.id)}
            ).scalar()
            average_score = round(float(avg_result), 2) if avg_result is not None else None
        except Exception as e:
            print(f"计算平均成绩失败: {e}")
            average_score = None
        
        # 获取班级关联的所有课程ID
        course_ids_list = []
        try:
            course_ids_result = db.execute(
                text("SELECT course_id FROM class_courses WHERE class_id = :class_id"),
                {"class_id": str(cls.id)}
            ).fetchall()
            course_ids_list = [str(row[0]) for row in course_ids_result]
        except Exception as e:
            print(f"获取班级课程失败: {e}")
            # 如果关联表查询失败，使用course_id字段
            if cls.course_id:
                course_ids_list = [str(cls.course_id)]
        
        result.append(ClassResponse(
            id=str(cls.id),
            class_name=cls.class_name,
            course_id=str(cls.course_id) if cls.course_id else "",
            course_name="",  # 不再显示课程名称
            max_students=cls.max_students,
            academic_year=cls.academic_year or '',
            invite_code=cls.invite_code,
            allow_self_enroll=cls.allow_self_enroll,
            status=cls.status,
            student_count=student_count_result or 0,
            average_score=average_score,
            course_ids=course_ids_list if course_ids_list else None
        ))
    
    return result

@router.post("/classes", response_model=ClassResponse)
async def create_class(
    class_data: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新班级"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以创建班级")
    
    # 确定要关联的课程ID列表
    course_ids = []
    if class_data.course_ids:
        course_ids = class_data.course_ids
    elif class_data.course_id:
        course_ids = [class_data.course_id]
    else:
        raise HTTPException(status_code=400, detail="必须提供至少一个课程")
    
    # 验证所有课程是否存在且属于当前教师
    courses = db.query(Course).filter(
        Course.id.in_(course_ids),
        Course.teacher_id == current_user.id
    ).all()
    
    if len(courses) != len(course_ids):
        raise HTTPException(status_code=404, detail="部分课程不存在或无权限")
    
    # 生成唯一邀请码
    invite_code = generate_invite_code()
    while db.query(Class).filter(Class.invite_code == invite_code).first():
        invite_code = generate_invite_code()
    
    # 创建班级（course_id设置为第一个课程，保持向后兼容）
    new_class = Class(
        class_name=class_data.class_name,
        course_id=courses[0].id if courses else None,
        teacher_id=current_user.id,
        max_students=class_data.max_students,
        academic_year=class_data.academic_year,
        invite_code=invite_code,
        allow_self_enroll=class_data.allow_self_enroll,
        status='active'
    )
    
    db.add(new_class)
    db.flush()  # 获取新班级的ID
    
    # 在关联表中添加所有课程关系
    from app.models.course import class_courses
    for course in courses:
        db.execute(
            class_courses.insert().values(
                class_id=new_class.id,
                course_id=course.id
            )
        )
    
    db.commit()
    db.refresh(new_class)
    
    # 获取课程名称（多个课程用逗号分隔）
    course_names = ", ".join([c.course_name for c in courses])
    
    return ClassResponse(
        id=str(new_class.id),
        class_name=new_class.class_name,
        course_id=str(new_class.course_id) if new_class.course_id else "",
        course_name=course_names,
        max_students=new_class.max_students,
        academic_year=new_class.academic_year,
        invite_code=new_class.invite_code,
        allow_self_enroll=new_class.allow_self_enroll,
        status=new_class.status,
        student_count=0
    )

@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除课程（软删除）"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以删除课程")
    
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.teacher_id == current_user.id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在或无权限")
    
    course.status = 'inactive'
    db.commit()
    
    return {"message": "课程已删除"}

@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除班级（软删除）"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以删除班级")
    
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id
    ).first()
    
    if not cls:
        raise HTTPException(status_code=404, detail="班级不存在或无权限")
    
    cls.status = 'inactive'
    db.commit()
    
    return {"message": "班级已删除"}

@router.put("/classes/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: str,
    class_data: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新班级信息"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以更新班级")
    
    # 查询班级
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id
    ).first()
    
    if not cls:
        raise HTTPException(status_code=404, detail="班级不存在或无权限")
    
    # 更新基本信息
    cls.class_name = class_data.class_name
    cls.max_students = class_data.max_students
    cls.academic_year = class_data.academic_year
    cls.allow_self_enroll = class_data.allow_self_enroll
    
    # 如果提供了课程列表，更新课程关联
    if class_data.course_ids:
        # 验证所有课程是否存在且属于当前教师
        courses = db.query(Course).filter(
            Course.id.in_(class_data.course_ids),
            Course.teacher_id == current_user.id
        ).all()
        
        if len(courses) != len(class_data.course_ids):
            raise HTTPException(status_code=404, detail="部分课程不存在或无权限")
        
        # 删除旧的课程关联
        from app.models.course import class_courses
        from sqlalchemy import text
        db.execute(
            text("DELETE FROM class_courses WHERE class_id = :class_id"),
            {"class_id": str(cls.id)}
        )
        
        # 添加新的课程关联
        for course in courses:
            db.execute(
                class_courses.insert().values(
                    class_id=cls.id,
                    course_id=course.id
                )
            )
        
        # 更新course_id为第一个课程
        cls.course_id = courses[0].id if courses else None
    
    db.commit()
    db.refresh(cls)
    
    # 获取学生数量
    from sqlalchemy import text
    try:
        student_count_result = db.execute(
            text("SELECT COUNT(*) FROM class_students WHERE class_id = :class_id AND status = 'active'"),
            {"class_id": str(cls.id)}
        ).scalar()
    except:
        student_count_result = 0
    
    return ClassResponse(
        id=str(cls.id),
        class_name=cls.class_name,
        course_id=str(cls.course_id) if cls.course_id else "",
        course_name="",
        max_students=cls.max_students,
        academic_year=cls.academic_year,
        invite_code=cls.invite_code,
        allow_self_enroll=cls.allow_self_enroll,
        status=cls.status,
        student_count=student_count_result or 0
    )
    db.commit()
    
    return {"message": "班级已删除"}

class StudentInClass(BaseModel):
    id: str
    username: str
    full_name: str
    email: str
    student_number: str
    major: str | None
    grade: str | None
    enrollment_date: str
    
    class Config:
        from_attributes = True

class ClassDetailResponse(BaseModel):
    id: str
    class_name: str
    course_id: str
    course_name: str
    max_students: int
    academic_year: str
    invite_code: str
    status: str
    student_count: int
    students: List[StudentInClass]
    
    class Config:
        from_attributes = True

@router.get("/classes/{class_id}/students", response_model=ClassDetailResponse)
async def get_class_students(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取班级的学生列表"""
    if current_user.role != 'teacher':
        raise HTTPException(status_code=403, detail="只有教师可以访问此接口")
    
    # 验证班级是否存在且属于当前教师
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.teacher_id == current_user.id,
        Class.status == 'active'
    ).first()
    
    if not cls:
        raise HTTPException(status_code=404, detail="班级不存在或无权限")
    
    # 获取课程信息
    course = db.query(Course).filter(Course.id == cls.course_id).first()
    
    # 获取班级学生列表
    from sqlalchemy import text
    from app.models.user import Student
    
    class_students = db.execute(
        text("""
            SELECT cs.student_id, cs.enrollment_date
            FROM class_students cs
            WHERE cs.class_id = :class_id AND cs.status = 'active'
            ORDER BY cs.enrollment_date DESC
        """),
        {"class_id": str(class_id)}
    ).fetchall()
    
    students_list = []
    for cs in class_students:
        user = db.query(User).filter(User.id == cs.student_id).first()
        if user and user.student:
            students_list.append(StudentInClass(
                id=str(user.id),
                username=user.username,
                full_name=user.full_name or user.username,
                email=user.email,
                student_number=user.student.student_number,
                major=user.student.major,
                grade=user.student.grade,
                enrollment_date=cs.enrollment_date.strftime("%Y-%m-%d") if cs.enrollment_date else ""
            ))
    
    return ClassDetailResponse(
        id=str(cls.id),
        class_name=cls.class_name,
        course_id=str(cls.course_id),
        course_name=course.course_name if course else "未知课程",
        max_students=cls.max_students,
        academic_year=cls.academic_year or '',
        invite_code=cls.invite_code,
        status=cls.status,
        student_count=len(students_list),
        students=students_list
    )
