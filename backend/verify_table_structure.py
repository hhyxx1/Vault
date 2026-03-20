"""验证qa_records表结构"""
import sys
import os
import locale

try:
    locale.setlocale(locale.LC_ALL, 'C.UTF-8')
except:
    try:
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except:
        pass

os.environ['PGCLIENTENCODING'] = 'UTF8'
os.environ['PYTHONUTF8'] = '1'

sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'qa_records'
            ORDER BY ordinal_position
        """))
        
        print("\n=== qa_records 表结构 ===\n")
        print(f"{'列名':<20} {'数据类型':<20} {'最大长度':<10}")
        print("-" * 50)
        
        for row in result:
            col_name = row[0]
            data_type = row[1]
            max_length = row[2] if row[2] else 'N/A'
            print(f"{col_name:<20} {data_type:<20} {max_length:<10}")
        
        print("\n✓ 验证成功！")
        
except Exception as e:
    print(f"验证失败: {e}")
    import traceback
    traceback.print_exc()
