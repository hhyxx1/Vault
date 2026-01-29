"""
检查知识库数据
"""
import sys
from pathlib import Path
import os

# 设置环境变量
os.environ['PGCLIENTENCODING'] = 'UTF8'
os.environ.setdefault('LANG', 'en_US.UTF-8')
os.environ.setdefault('LC_ALL', 'en_US.UTF-8')

# 添加项目路径
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from app.config.settings import Settings

settings = Settings()

print("=" * 80)
print("检查知识库数据")
print("=" * 80)

# 连接数据库
print(f"\n连接数据库: {settings.DATABASE_URL}")
engine = create_engine(settings.DATABASE_URL)

with engine.connect() as conn:
    # 1. 检查 course_documents 表
    print("\n1. 课程文档表 (course_documents)")
    print("-" * 80)
    result = conn.execute(text("""
        SELECT 
            id, 
            file_name, 
            file_type, 
            file_size,
            upload_status,
            processed_status,
            error_message,
            created_at
        FROM course_documents 
        ORDER BY created_at DESC 
        LIMIT 10
    """))
    
    rows = result.fetchall()
    if rows:
        print(f"   找到 {len(rows)} 条记录:")
        for row in rows:
            print(f"\n   - ID: {row[0]}")
            print(f"     文件名: {row[1]}")
            print(f"     类型: {row[2]}, 大小: {row[3]} bytes")
            print(f"     上传状态: {row[4]}")
            print(f"     处理状态: {row[5]}")
            if row[6]:
                print(f"     错误信息: {row[6]}")
            print(f"     创建时间: {row[7]}")
    else:
        print("   没有找到记录")
    
    # 2. 检查 knowledge_base 表
    print("\n\n2. 知识库表 (knowledge_base)")
    print("-" * 80)
    result = conn.execute(text("""
        SELECT 
            COUNT(*) as total_chunks,
            COUNT(DISTINCT document_id) as total_documents,
            COUNT(DISTINCT course_id) as total_courses
        FROM knowledge_base
    """))
    
    row = result.fetchone()
    print(f"   总文本块数: {row[0]}")
    print(f"   总文档数: {row[1]}")
    print(f"   总课程数: {row[2]}")
    
    # 3. 按文档统计
    print("\n\n3. 按文档统计文本块")
    print("-" * 80)
    result = conn.execute(text("""
        SELECT 
            kb.document_id,
            cd.file_name,
            COUNT(*) as chunk_count,
            MAX(kb.chunk_index) + 1 as max_chunks
        FROM knowledge_base kb
        LEFT JOIN course_documents cd ON kb.document_id = cd.id
        GROUP BY kb.document_id, cd.file_name
        ORDER BY chunk_count DESC
        LIMIT 10
    """))
    
    rows = result.fetchall()
    if rows:
        print(f"   找到 {len(rows)} 个文档:")
        for row in rows:
            print(f"\n   - 文档ID: {row[0]}")
            print(f"     文件名: {row[1] or '未知'}")
            print(f"     文本块数: {row[2]}")
    else:
        print("   没有找到记录")

# 4. 检查向量数据库 (ChromaDB)
print("\n\n4. 向量数据库 (ChromaDB)")
print("-" * 80)

try:
    from app.services.vector_db_service import get_vector_db
    
    vector_db = get_vector_db()
    stats = vector_db.get_stats()
    
    print(f"   集合名称: {stats.get('collection_name')}")
    print(f"   文档总数: {stats.get('total_documents')}")
    
    # 尝试获取一个示例文档
    if stats.get('total_documents', 0) > 0:
        print("\n   最近的向量记录:")
        # 这里可以添加更多查询逻辑
        
except Exception as e:
    print(f"   [错误] 无法连接向量数据库: {str(e)}")

print("\n" + "=" * 80)
print("检查完成")
print("=" * 80)
