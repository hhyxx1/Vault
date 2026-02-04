import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy import text
from app.database import engine

def add_limit_column():
    """添加limit字段到qa_shares表"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'qa_shares' AND column_name = 'limit'"))
            exists = result.fetchone()
            
            if not exists:
                conn.execute(text('ALTER TABLE qa_shares ADD COLUMN "limit" INTEGER'))
                conn.commit()
                print("✅ 成功添加limit字段到qa_shares表")
            else:
                print("ℹ️  limit字段已存在，跳过添加")
    except Exception as e:
        print(f"❌ 添加字段失败: {e}")
        raise

if __name__ == "__main__":
    add_limit_column()
