#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将PostgreSQL中的真实文档内容同步到ChromaDB向量数据库
"""

import psycopg2
import sys
import os

# 添加app目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.vector_db_service import VectorDBService

DATABASE_URL = "postgresql://postgres:123456@localhost:5432/app_project"

def sync_to_chromadb():
    """将PostgreSQL中的数据同步到ChromaDB"""
    
    print("=" * 80)
    print("🔄 同步PostgreSQL数据到ChromaDB向量数据库")
    print("=" * 80)
    
    try:
        # 连接数据库
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 初始化向量服务
        vector_service = VectorDBService()
        collection = vector_service.course_collection
        
        # 1. 清空ChromaDB旧数据
        print("\n1️⃣ 清空ChromaDB旧数据...")
        old_count = collection.count()
        print(f"   当前数据: {old_count} 个向量")
        
        if old_count > 0:
            # 获取所有ID并删除
            all_data = collection.get()
            if all_data['ids']:
                collection.delete(ids=all_data['ids'])
                print(f"   ✅ 已删除 {len(all_data['ids'])} 个旧向量")
        
        # 2. 从PostgreSQL读取真实数据
        print("\n2️⃣ 从PostgreSQL读取真实文档内容...")
        cursor.execute("""
            SELECT 
                kb.id,
                kb.document_id,
                kb.course_id,
                kb.chunk_text,
                kb.chunk_index,
                kb.chunk_metadata,
                cd.file_name,
                cd.file_type
            FROM knowledge_base kb
            JOIN course_documents cd ON kb.document_id = cd.id
            WHERE cd.file_type = '.pptx'
            ORDER BY cd.created_at, kb.chunk_index;
        """)
        
        chunks = cursor.fetchall()
        print(f"   ✅ 读取到 {len(chunks)} 个文本块")
        
        # 3. 生成向量并保存到ChromaDB
        print("\n3️⃣ 生成向量并保存到ChromaDB...")
        
        success_count = 0
        fail_count = 0
        
        batch_ids = []
        batch_documents = []
        batch_embeddings = []
        batch_metadatas = []
        
        for i, chunk in enumerate(chunks, 1):
            kb_id, doc_id, course_id, chunk_text, chunk_index, metadata, file_name, file_type = chunk
            
            try:
                # 生成唯一ID
                vector_id = f"{doc_id}_chunk_{chunk_index}"
                
                # 生成向量
                embedding = vector_service.model.encode([chunk_text])[0]
                
                # 准备元数据
                chunk_metadata = {
                    'document_id': str(doc_id),
                    'course_id': str(course_id),
                    'file_name': file_name,
                    'file_type': file_type,
                    'chunk_index': chunk_index
                }
                
                # 添加到批次
                batch_ids.append(vector_id)
                batch_documents.append(chunk_text)
                batch_embeddings.append(embedding.tolist())
                batch_metadatas.append(chunk_metadata)
                
                # 每50个批量保存一次
                if len(batch_ids) >= 50 or i == len(chunks):
                    collection.add(
                        ids=batch_ids,
                        documents=batch_documents,
                        embeddings=batch_embeddings,
                        metadatas=batch_metadatas
                    )
                    success_count += len(batch_ids)
                    print(f"   进度: {success_count}/{len(chunks)} ({success_count*100//len(chunks)}%)")
                    
                    # 清空批次
                    batch_ids = []
                    batch_documents = []
                    batch_embeddings = []
                    batch_metadatas = []
                
            except Exception as e:
                fail_count += 1
                print(f"   ❌ 块 {i} 失败: {e}")
        
        cursor.close()
        conn.close()
        
        # 4. 验证结果
        print("\n4️⃣ 验证同步结果...")
        new_count = collection.count()
        print(f"   ✅ ChromaDB现有向量: {new_count} 个")
        
        # 显示示例
        if new_count > 0:
            results = collection.peek(limit=3)
            print(f"\n   📄 示例向量:")
            for i in range(min(3, len(results['ids']))):
                doc_id = results['ids'][i]
                metadata = results['metadatas'][i] if results['metadatas'] else {}
                doc_text = results['documents'][i][:100] if results['documents'] else ""
                
                print(f"\n   向量 {i+1}:")
                print(f"   文件: {metadata.get('file_name', 'unknown')}")
                print(f"   块索引: {metadata.get('chunk_index', 0)}")
                print(f"   内容: {doc_text}...")
        
        print("\n" + "=" * 80)
        print(f"✅ 同步完成!")
        print(f"   成功: {success_count} 个")
        print(f"   失败: {fail_count} 个")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ 同步失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("\n🚀 开始同步数据到ChromaDB...\n")
    sync_to_chromadb()
    
    print("\n\n💡 提示:")
    print("   现在上传新文件时，系统会自动:")
    print("   1. 解析文件内容（PPT/Word/PDF）")
    print("   2. 保存到PostgreSQL数据库")
    print("   3. 保存到ChromaDB向量数据库")
    print("   4. 可以通过向量检索查询相关内容")
