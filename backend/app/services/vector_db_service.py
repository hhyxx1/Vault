"""
向量数据库服务
使用ChromaDB存储和检索文档
"""
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import os
from datetime import datetime


class VectorDBService:
    """向量数据库服务类"""
    
    def __init__(self):
        try:
            # 数据存储路径 - 使用绝对路径确保正确
            # 获取backend目录的绝对路径
            from pathlib import Path
            backend_dir = Path(__file__).resolve().parent.parent.parent
            db_path = backend_dir / "data" / "chroma_db"
            db_path.mkdir(parents=True, exist_ok=True)
            
            print(f"向量数据库路径: {db_path}")
            
            # 创建ChromaDB客户端
            self.client = chromadb.PersistentClient(
                path=str(db_path),
                settings=Settings(anonymized_telemetry=False)
            )
            
            # 加载向量化模型（支持中文）
            print("正在加载向量化模型...")
            self.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            print("向量化模型加载完成")
            
            # 创建问卷文档集合
            self.collection = self.client.get_or_create_collection(
                name="survey_documents",
                metadata={"description": "问卷文档知识库"}
            )
            
        except Exception as e:
            print(f"向量数据库初始化失败: {e}")
            raise
    
    def add_document(
        self, 
        doc_id: str, 
        content: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        添加文档到向量数据库
        
        Args:
            doc_id: 文档唯一ID
            content: 文档内容
            metadata: 文档元数据
            
        Returns:
            是否添加成功
        """
        try:
            # 生成向量
            embedding = self.model.encode([content]).tolist()[0]
            
            # 准备元数据
            if metadata is None:
                metadata = {}
            metadata['indexed_at'] = datetime.now().isoformat()
            
            # 添加到数据库
            self.collection.add(
                ids=[doc_id],
                documents=[content],
                embeddings=[embedding],
                metadatas=[metadata]
            )
            return True
        except Exception as e:
            print(f"添加文档失败: {e}")
            return False
    
    def search_similar(
        self, 
        query: str, 
        n_results: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        搜索相似文档
        
        Args:
            query: 查询文本
            n_results: 返回结果数量
            filter_metadata: 元数据过滤条件
            
        Returns:
            相似文档列表
        """
        try:
            # 生成查询向量
            query_embedding = self.model.encode([query]).tolist()
            
            # 构建查询参数
            query_params = {
                "query_embeddings": query_embedding,
                "n_results": n_results,
                "include": ["documents", "metadatas", "distances"]
            }
            
            if filter_metadata:
                query_params["where"] = filter_metadata
            
            # 查询
            results = self.collection.query(**query_params)
            
            # 格式化结果
            formatted_results = []
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "similarity": 1 - results['distances'][0][i]  # 转换为相似度分数(0-1)
                })
            
            return formatted_results
        except Exception as e:
            print(f"搜索失败: {e}")
            return []
    
    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        获取指定文档
        
        Args:
            doc_id: 文档ID
            
        Returns:
            文档信息或None
        """
        try:
            results = self.collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )
            
            if results['ids']:
                return {
                    "id": results['ids'][0],
                    "content": results['documents'][0],
                    "metadata": results['metadatas'][0]
                }
            return None
        except Exception as e:
            print(f"获取文档失败: {e}")
            return None
    
    def delete_document(self, doc_id: str) -> bool:
        """
        删除文档
        
        Args:
            doc_id: 文档ID
            
        Returns:
            是否删除成功
        """
        try:
            self.collection.delete(ids=[doc_id])
            return True
        except Exception as e:
            print(f"删除文档失败: {e}")
            return False
    
    def check_duplicate(self, content: str, similarity_threshold: float = 0.95) -> Optional[Dict[str, Any]]:
        """
        检查是否存在相似文档（用于去重）
        
        Args:
            content: 文档内容
            similarity_threshold: 相似度阈值(0-1)，默认0.95
            
        Returns:
            如果找到相似文档，返回文档信息，否则返回None
        """
        try:
            # 搜索最相似的文档
            results = self.search_similar(content, n_results=1)
            
            if results and results[0]['similarity'] >= similarity_threshold:
                return results[0]
            return None
        except Exception as e:
            print(f"检查重复文档失败: {e}")
            return None
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取数据库统计信息
        
        Returns:
            统计信息
        """
        try:
            count = self.collection.count()
            return {
                "total_documents": count,
                "collection_name": self.collection.name,
                "metadata": self.collection.metadata
            }
        except Exception as e:
            print(f"获取统计信息失败: {e}")
            return {"total_documents": 0}


# 创建全局实例（懒加载）
_vector_db_instance = None

def get_vector_db() -> VectorDBService:
    """获取向量数据库实例（单例模式）"""
    global _vector_db_instance
    if _vector_db_instance is None:
        _vector_db_instance = VectorDBService()
    return _vector_db_instance
