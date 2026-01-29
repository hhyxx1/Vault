#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理重复的文档数据
- 保留每个文件名的最新记录
- 删除PostgreSQL中的重复数据
- 删除ChromaDB中对应的向量
"""

import os
import sys
import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.vector_db_service import VectorDBService

DATABASE_URL = "postgresql://postgres:123456@localhost:5432/app_project"

def clean_duplicates():
    """清理重复的文档数据"""
    
    print("=" * 80)
    print("🔍 查找并清理重复的文档")
    print("=" * 80)
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cursor = conn.cursor()
        
        # 1. 查找重复的文档（同一课程下相同文件名）
        print("\n1️⃣ 查找重复文档...")
        cursor.execute("""
            WITH ranked_docs AS (
                SELECT 
                    id,
                    course_id,
                    file_name,
                    created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY course_id, file_name 
                        ORDER BY created_at DESC
                    ) as rn
                FROM course_documents
            )
            SELECT 
                rd.id,
                rd.course_id,
                rd.file_name,
                rd.created_at,
                c.course_name
            FROM ranked_docs rd
            JOIN courses c ON rd.course_id = c.id
            WHERE rd.rn > 1
            ORDER BY rd.file_name, rd.created_at;
        """)
        
        duplicates = cursor.fetchall()
        
        if not duplicates:
            print("   ✅ 没有发现重复文档")
            cursor.close()
            conn.close()
            return
        
        print(f"   ⚠️  发现 {len(duplicates)} 个重复文档\n")
        
        # 显示重复文档列表和文件路径
        print("   重复文档列表:")
        duplicate_file_paths = []
        for doc in duplicates:
            doc_id, course_id, file_name, created_at, course_name = doc
            print(f"   - {file_name}")
            print(f"     课程: {course_name}")
            print(f"     ID: {doc_id}")
            print(f"     创建时间: {created_at}")
            
            # 查询文件路径
            cursor.execute("SELECT file_path FROM course_documents WHERE id = %s", (doc_id,))
            file_path_result = cursor.fetchone()
            if file_path_result:
                duplicate_file_paths.append((doc_id, file_name, file_path_result[0]))
                print(f"     路径: {file_path_result[0]}\n")
            else:
                print()
        
        # 2. 删除本地物理文件
        print("2️⃣ 删除本地物理文件...")
        
        deleted_files = 0
        failed_files = 0
        
        for doc_id, file_name, file_path in duplicate_file_paths:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    deleted_files += 1
                    print(f"   ✅ 删除文件: {file_name}")
                except Exception as e:
                    failed_files += 1
                    print(f"   ❌ 删除失败 ({file_name}): {e}")
            else:
                print(f"   ⚠️  文件不存在: {file_name}")
        
        print(f"\n   成功删除: {deleted_files} 个物理文件")
        if failed_files > 0:
            print(f"   失败: {failed_files} 个")
        
        # 3. 从PostgreSQL删除记录
        print("\n3️⃣ 从PostgreSQL删除重复文档记录...")
        
        duplicate_ids = [doc[0] for doc in duplicates]  # 保持UUID类型
        
        # 删除knowledge_base中的数据（有外键依赖）
        placeholders = ','.join(['%s'] * len(duplicate_ids))
        cursor.execute(f"""
            DELETE FROM knowledge_base
            WHERE document_id IN ({placeholders});
        """, duplicate_ids)
        kb_deleted = cursor.rowcount
        print(f"   ✅ 删除knowledge_base: {kb_deleted} 条记录")
        
        # 删除course_documents中的数据
        cursor.execute(f"""
            DELETE FROM course_documents
            WHERE id IN ({placeholders});
        """, duplicate_ids)
        doc_deleted = cursor.rowcount
        print(f"   ✅ 删除course_documents: {doc_deleted} 条记录")
        
        # 提交PostgreSQL事务
        conn.commit()
        print(f"   ✅ PostgreSQL数据已提交")
        
        # 4. 删除ChromaDB中的向量（后台处理，如果失败也不影响）
        print("\n4️⃣ 从ChromaDB删除重复文档的向量...")
        
        try:
            vector_service = VectorDBService()
            collection = vector_service.course_collection
            
            deleted_vector_count = 0
            
            for doc in duplicates:
                doc_id = str(doc[0])
                file_name = doc[2]
                
                try:
                    # 查询该文档的所有向量ID
                    results = collection.get(
                        where={"document_id": doc_id}
                    )
                    
                    if results and results['ids']:
                        collection.delete(ids=results['ids'])
                        deleted_vector_count += len(results['ids'])
                        print(f"   ✅ 删除 {file_name}: {len(results['ids'])} 个向量")
                except Exception as e:
                    print(f"   ⚠️  删除向量失败 ({file_name}): {e}")
            
            print(f"\n   总计删除ChromaDB向量: {deleted_vector_count} 个")
        except Exception as e:
            print(f"   ⚠️  ChromaDB清理失败: {e}")
            print(f"   提示: 可以手动重启ChromaDB或忽略此错误")
        
        # 5. 验证结果
        print("\n5️⃣ 验证PostgreSQL清理结果...")
        
        cursor.execute("""
            SELECT 
                course_id,
                file_name,
                COUNT(*) as count
            FROM course_documents
            GROUP BY course_id, file_name
            HAVING COUNT(*) > 1;
        """)
        
        remaining_duplicates = cursor.fetchall()
        
        if remaining_duplicates:
            print(f"   ⚠️  仍有 {len(remaining_duplicates)} 个重复文档")
            for dup in remaining_duplicates:
                print(f"   - {dup[1]}: {dup[2]} 个副本")
        else:
            print("   ✅ 所有重复文档已清理完成")
        
        # 显示最终统计
        cursor.execute("SELECT COUNT(*) FROM course_documents;")
        total_docs = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM knowledge_base;")
        total_chunks = cursor.fetchone()[0]
        
        print(f"\n📊 清理后统计:")
        print(f"   文档总数: {total_docs}")
        print(f"   文本块总数: {total_chunks}")
        
        # 尝试获取ChromaDB统计（可能失败）
        try:
            vector_service = VectorDBService()
            print(f"   ChromaDB向量数: {vector_service.course_collection.count()}")
        except:
            print(f"   ChromaDB向量数: (需要手动验证)")
        
        cursor.close()
        conn.close()
        
        print("\n" + "=" * 80)
        print("✅ 清理完成!")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ 清理失败: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

def show_current_documents():
    """显示当前所有文档"""
    
    print("\n" + "=" * 80)
    print("📋 当前文档列表")
    print("=" * 80)
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                c.course_name,
                cd.file_name,
                cd.created_at,
                COUNT(kb.id) as chunks
            FROM course_documents cd
            JOIN courses c ON cd.course_id = c.id
            LEFT JOIN knowledge_base kb ON cd.id = kb.document_id
            GROUP BY c.course_name, cd.file_name, cd.created_at
            ORDER BY c.course_name, cd.file_name, cd.created_at DESC;
        """)
        
        docs = cursor.fetchall()
        
        if not docs:
            print("\n   没有文档")
        else:
            current_course = None
            for doc in docs:
                course_name, file_name, created_at, chunks = doc
                
                if course_name != current_course:
                    print(f"\n📚 {course_name}")
                    current_course = course_name
                
                print(f"   - {file_name}")
                print(f"     上传时间: {created_at}")
                print(f"     文本块: {chunks} 个")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 查询失败: {e}")

if __name__ == "__main__":
    print("\n🚀 开始清理重复文档...\n")
    
    # 显示当前文档
    show_current_documents()
    
    # 清理重复数据
    clean_duplicates()
    
    # 再次显示文档列表
    show_current_documents()
