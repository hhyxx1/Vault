"""Add intent and skill_used columns to qa_records table"""
import sys
import os

# 设置环境变量解决编码问题
os.environ['PGCLIENTENCODING'] = 'UTF8'
os.environ.setdefault('LANG', 'en_US.UTF-8')
os.environ.setdefault('LC_ALL', 'en_US.UTF-8')

# 添加app目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, text

# 使用与app相同的数据库配置（与settings.py保持一致）
DATABASE_URL = "postgresql://postgres:123456@localhost:5432/app_project"

try:
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            'client_encoding': 'utf8',
            'options': '-c client_encoding=utf8'
        }
    )
    
    with engine.connect() as conn:
        # Add intent column
        conn.execute(text("""
            ALTER TABLE qa_records 
            ADD COLUMN IF NOT EXISTS intent VARCHAR(50)
        """))
        
        # Add skill_used column
        conn.execute(text("""
            ALTER TABLE qa_records 
            ADD COLUMN IF NOT EXISTS skill_used VARCHAR(200)
        """))
        
        conn.commit()
    
    print("[SUCCESS] Migration completed! Added intent and skill_used columns to qa_records table")
    
except Exception as e:
    print(f"[ERROR] Migration failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
