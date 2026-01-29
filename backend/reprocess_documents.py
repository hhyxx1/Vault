#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重新处理已上传的PPT文档,提取真实内容
"""

import psycopg2
import os
import sys

# 添加app目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.document_processor import DocumentProcessor
from services.vector_db_service import VectorDBService

DATABASE_URL = "postgresql://postgres:123456@localhost:5432/app_project"

def reprocess_documents():
    """重新处理所有PPT文档"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("=" * 60)
        print("查找需要重新处理的文档...")
        print("=" * 60)
        
        # 查询所有需要重新处理的PPT文档
        cursor.execute("""
            SELECT id, course_id, file_name, file_path, file_type
            FROM course_documents
            WHERE file_type = '.pptx'
            AND processed_status = 'completed'
            ORDER BY created_at;
        """)
        
        documents = cursor.fetchall()
        print(f"\n找到 {len(documents)} 个PPT文档需要重新处理\n")
        
        if not documents:
            print("没有需要处理的文档")
            return
        
        # 初始化服务
        processor = DocumentProcessor()
        vector_service = VectorDBService()
        
        success_count = 0
        fail_count = 0
        
        for doc_id, course_id, file_name, file_path, file_type in documents:
            print(f"🔄 处理: {file_name}")
            print(f"   路径: {file_path}")
            
            # 检查文件是否存在
            if not os.path.exists(file_path):
                print(f"   ❌ 文件不存在,跳过\n")
                fail_count += 1
                continue
            
            try:
                # 1. 删除旧的知识库数据
                cursor.execute("""
                    DELETE FROM knowledge_base
                    WHERE document_id = %s;
                """, (doc_id,))
                print(f"   🗑️  已删除旧数据")
                
                # 2. 重新提取文档内容
                text = processor.extract_text(file_path, file_type)
                print(f"   📄 提取成功: {len(text)} 字符")
                
                if text:
                    # 显示前100字符
                    preview = text[:100] if text else ""
                    print(f"   内容预览: {preview}...")
                
                # 切分成文本块
                chunks_data = processor.split_text_into_chunks(text, {
                    "document_id": str(doc_id),
                    "course_id": str(course_id),
                    "file_name": file_name,
                    "file_type": file_type
                })
                print(f"   ✂️  文本切分: {len(chunks_data)} 个文本块")
                
                # 3. 生成向量并保存
                for chunk_data in chunks_data:
                    chunk_text = chunk_data['text']
                    chunk_index = chunk_data['chunk_index']
                    
                    # 生成向量
                    embedding = vector_service.model.encode([chunk_text])[0]
                    
                    # 保存到知识库
                    cursor.execute("""
                        INSERT INTO knowledge_base
                        (document_id, course_id, chunk_text, chunk_index, chunk_metadata, embedding_vector)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        doc_id,
                        course_id,
                        chunk_text,
                        chunk_index,
                        f'{{"document_id": "{doc_id}", "course_id": "{course_id}", "file_name": "{file_name}", "file_type": "{file_type}"}}',
                        str(embedding.tolist())
                    ))
                
                # 4. 更新处理状态
                cursor.execute("""
                    UPDATE course_documents
                    SET processed_status = 'completed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (doc_id,))
                
                conn.commit()
                print(f"   ✅ 处理完成: {len(chunks_data)} 个文本块已保存\n")
                success_count += 1
                
            except Exception as e:
                conn.rollback()
                print(f"   ❌ 处理失败: {e}\n")
                fail_count += 1
                import traceback
                traceback.print_exc()
        
        cursor.close()
        conn.close()
        
        print("=" * 60)
        print(f"✅ 重新处理完成!")
        print(f"   成功: {success_count} 个")
        print(f"   失败: {fail_count} 个")
        print("=" * 60)
        
        # 验证结果
        verify_reprocessing()
        
    except Exception as e:
        print(f"\n❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()

def verify_reprocessing():
    """验证重新处理的结果"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("\n" + "=" * 60)
        print("验证处理结果...")
        print("=" * 60)
        
        cursor.execute("""
            SELECT 
                cd.file_name,
                COUNT(kb.id) as chunk_count,
                LEFT(kb.chunk_text, 80) as sample_text
            FROM course_documents cd
            LEFT JOIN knowledge_base kb ON cd.id = kb.document_id
            WHERE cd.file_type = '.pptx'
            GROUP BY cd.id, cd.file_name, kb.chunk_text
            ORDER BY cd.file_name
            LIMIT 5;
        """)
        
        docs = cursor.fetchall()
        print(f"\n前5个文档的处理结果:\n")
        for doc in docs:
            file_name, chunks, sample = doc
            is_placeholder = "[PowerPoint文件内容提取需要安装python-pptx库]" in (sample or "")
            status = "❌ 占位文本" if is_placeholder else "✅ 真实内容"
            print(f"{status} {file_name}")
            print(f"         文本块数: {chunks}")
            print(f"         内容: {sample}...\n")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 验证失败: {e}")

if __name__ == "__main__":
    print("\n🚀 开始重新处理文档...\n")
    reprocess_documents()
