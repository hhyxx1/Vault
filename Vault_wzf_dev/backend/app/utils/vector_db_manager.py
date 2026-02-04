"""
向量数据库管理工具
用于查看、管理向量数据库中的文档
"""
from app.services.vector_db_service import get_vector_db
from typing import List, Dict, Any
import json


class VectorDBManager:
    """向量数据库管理器"""
    
    def __init__(self):
        self.db = get_vector_db()
    
    def list_all_documents(self) -> List[Dict[str, Any]]:
        """
        列出所有文档
        
        Returns:
            文档列表
        """
        try:
            # 获取所有文档
            collection = self.db.collection
            results = collection.get(
                include=["documents", "metadatas"]
            )
            
            documents = []
            if results['ids']:
                for i in range(len(results['ids'])):
                    documents.append({
                        "id": results['ids'][i],
                        "content": results['documents'][i][:200] + "..." if len(results['documents'][i]) > 200 else results['documents'][i],
                        "metadata": results['metadatas'][i]
                    })
            
            return documents
        except Exception as e:
            print(f"获取文档列表失败: {e}")
            return []
    
    def search_by_filename(self, filename: str) -> List[Dict[str, Any]]:
        """
        根据文件名搜索文档
        
        Args:
            filename: 文件名
            
        Returns:
            匹配的文档列表
        """
        try:
            collection = self.db.collection
            results = collection.get(
                where={"filename": filename},
                include=["documents", "metadatas"]
            )
            
            documents = []
            if results['ids']:
                for i in range(len(results['ids'])):
                    documents.append({
                        "id": results['ids'][i],
                        "content": results['documents'][i],
                        "metadata": results['metadatas'][i]
                    })
            
            return documents
        except Exception as e:
            print(f"搜索文档失败: {e}")
            return []
    
    def check_document_exists(self, file_id: str) -> bool:
        """
        检查文档是否存在
        
        Args:
            file_id: 文件ID
            
        Returns:
            是否存在
        """
        doc = self.db.get_document(file_id)
        return doc is not None
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取数据库统计信息
        
        Returns:
            统计信息
        """
        stats = self.db.get_stats()
        
        # 获取所有文档的元数据进行统计
        all_docs = self.list_all_documents()
        
        filenames = set()
        total_questions = 0
        
        for doc in all_docs:
            metadata = doc.get('metadata', {})
            if metadata.get('filename'):
                filenames.add(metadata['filename'])
            total_questions += metadata.get('question_count', 0)
        
        return {
            "total_documents": stats['total_documents'],
            "unique_files": len(filenames),
            "total_questions": total_questions,
            "collection_name": stats['collection_name']
        }
    
    def print_all_documents(self):
        """打印所有文档信息"""
        print("\n" + "=" * 80)
        print("向量数据库文档列表")
        print("=" * 80)
        
        docs = self.list_all_documents()
        
        if not docs:
            print("\n📭 数据库为空，暂无文档")
        else:
            for i, doc in enumerate(docs, 1):
                print(f"\n📄 文档 {i}:")
                print(f"  ID: {doc['id']}")
                print(f"  元数据: {json.dumps(doc['metadata'], ensure_ascii=False, indent=2)}")
                print(f"  内容预览: {doc['content']}")
        
        print("\n" + "=" * 80)
        
        # 打印统计信息
        stats = self.get_statistics()
        print("\n📊 统计信息:")
        print(f"  总文档数: {stats['total_documents']}")
        print(f"  独立文件数: {stats['unique_files']}")
        print(f"  总题目数: {stats['total_questions']}")
        print(f"  集合名称: {stats['collection_name']}")
        print("\n" + "=" * 80)


def main():
    """主函数 - 命令行工具"""
    import sys
    
    manager = VectorDBManager()
    
    if len(sys.argv) < 2:
        print("向量数据库管理工具")
        print("\n用法:")
        print("  python -m app.utils.vector_db_manager list           # 列出所有文档")
        print("  python -m app.utils.vector_db_manager stats          # 显示统计信息")
        print("  python -m app.utils.vector_db_manager search <filename>  # 搜索文件")
        print("  python -m app.utils.vector_db_manager check <file_id>    # 检查文档是否存在")
        return
    
    command = sys.argv[1]
    
    if command == "list":
        manager.print_all_documents()
    
    elif command == "stats":
        stats = manager.get_statistics()
        print("\n📊 向量数据库统计信息:")
        print(f"  总文档数: {stats['total_documents']}")
        print(f"  独立文件数: {stats['unique_files']}")
        print(f"  总题目数: {stats['total_questions']}")
        print(f"  集合名称: {stats['collection_name']}")
    
    elif command == "search" and len(sys.argv) > 2:
        filename = sys.argv[2]
        docs = manager.search_by_filename(filename)
        print(f"\n🔍 搜索文件: {filename}")
        print(f"找到 {len(docs)} 个结果\n")
        for doc in docs:
            print(f"ID: {doc['id']}")
            print(f"内容: {doc['content'][:200]}...\n")
    
    elif command == "check" and len(sys.argv) > 2:
        file_id = sys.argv[2]
        exists = manager.check_document_exists(file_id)
        print(f"\n文档 {file_id}: {'✓ 存在' if exists else '✗ 不存在'}")
    
    else:
        print("❌ 未知命令或缺少参数")


if __name__ == "__main__":
    main()
