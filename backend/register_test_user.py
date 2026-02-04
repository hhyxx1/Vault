
import sys
import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, init_db
from app.models.user import User, Student
from app.utils.auth import get_password_hash

def register_test_user():
    # 初始化数据库
    print("正在初始化数据库表...")
    init_db()
    print("数据库表初始化完成。")
    db = SessionLocal()
    try:
        # 检查是否已存在
        user = db.query(User).filter(User.username == "test_student").first()
        if user:
            print(f"用户 {user.username} 已存在")
            return

        # 创建新用户
        hashed_password = get_password_hash("password123")
        new_user = User(
            username="test_student",
            email="test_student@example.com",
            password_hash=hashed_password,
            role="student",
            full_name="测试学生",
            is_active=True
        )
        db.add(new_user)
        db.flush()

        student = Student(
            user_id=new_user.id,
            student_number="S12345",
            major="计算机科学",
            grade="2024"
        )
        db.add(student)
        db.commit()
        print("测试学生账号注册成功:")
        print("用户名: test_student")
        print("密码: password123")
        print("角色: student")
    except Exception as e:
        db.rollback()
        print(f"注册失败: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # 添加当前目录到路径
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    register_test_user()
