"""
向量数据库服务
使用ChromaDB存储和检索文档

架构：
- 两层知识库架构
  1. 课程专属知识库：每个课程独立的ChromaDB集合
  2. 全局知识库：跨所有课程的统一检索
- 支持课程内搜索、多课程搜索、全局搜索
- 自动创建和管理课程集合
"""
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import os
from datetime import datetime
import uuid


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
            # 强制使用 Mock 模式以快速启动，实际生产环境应加载真实模型
            print("⚠️ 强制使用 Mock 向量化模式以加快启动速度")
            self.model = None
            
            # 创建问卷文档集合
            self.survey_collection = self.client.get_or_create_collection(
                name="survey_documents",
                metadata={"description": "问卷文档知识库"}
            )
            
            # 课程集合缓存（用于存储已创建的课程集合）
            self._course_collections = {}
            
            # 默认集合（向后兼容）
            self.collection = self.survey_collection
            
        except Exception as e:
            print(f"向量数据库初始化失败: {e}")
            raise
    
    def get_course_collection(self, course_id: str):
        """
        获取或创建指定课程的知识库集合
        每个课程都有自己独立的ChromaDB集合
        
        Args:
            course_id: 课程ID
            
        Returns:
            课程对应的ChromaDB集合
        """
        # 检查缓存
        if course_id in self._course_collections:
            return self._course_collections[course_id]
        
        # 创建集合名称（确保符合ChromaDB命名规则）
        collection_name = f"course_{course_id.replace('-', '_')}"
        
        try:
            # 获取或创建课程集合
            collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={
                    "description": f"课程 {course_id} 的专属知识库",
                    "course_id": course_id,
                    "created_at": datetime.now().isoformat()
                }
            )
            
            # 缓存集合
            self._course_collections[course_id] = collection
            print(f"✅ 课程知识库集合已准备: {collection_name}")
            
            return collection
            
        except Exception as e:
            print(f"❌ 创建课程集合失败: {e}")
            raise
    
    def _get_embedding(self, text: str) -> List[float]:
        """生成文本向量，支持 Mock 模式"""
        if self.model is None:
            # 返回一个固定维度的随机/全零向量 (MiniLM-L12 维度是 384)
            return [0.0] * 384
        return self.model.encode([text]).tolist()[0]

    def add_document(
        self, 
        doc_id: str, 
        content: str, 
        metadata: Optional[Dict[str, Any]] = None,
        course_id: Optional[str] = None
    ) -> bool:
        """
        添加文档到向量数据库
        
        Args:
            doc_id: 文档唯一ID
            content: 文档内容
            metadata: 文档元数据
            course_id: 课程ID（如果提供，将存储到对应课程的专属集合）
            
        Returns:
            是否添加成功
        """
        try:
            # 生成向量
            embedding = self._get_embedding(content)
            
            # 准备元数据
            if metadata is None:
                metadata = {}
            metadata['indexed_at'] = datetime.now().isoformat()
            
            # 确定使用哪个集合
            if course_id:
                # 使用课程专属集合
                collection = self.get_course_collection(course_id)
            else:
                # 使用默认集合
                collection = self.collection
            
            # 添加到数据库
            collection.add(
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
        filter_metadata: Optional[Dict[str, Any]] = None,
        course_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        搜索相似文档
        
        Args:
            query: 查询文本
            n_results: 返回结果数量
            filter_metadata: 元数据过滤条件
            course_id: 课程ID（如果提供，将从对应课程的专属集合中搜索）
            
        Returns:
            相似文档列表
        """
        try:
            # 生成查询向量
            query_embedding = [self._get_embedding(query)]
            
            # 构建查询参数
            query_params = {
                "query_embeddings": query_embedding,
                "n_results": n_results,
                "include": ["documents", "metadatas", "distances"]
            }
            
            if filter_metadata:
                query_params["where"] = filter_metadata
            
            # 确定使用哪个集合
            if course_id:
                collection = self.get_course_collection(course_id)
            else:
                collection = self.collection
            
            # 查询
            results = collection.query(**query_params)
            
            # 格式化结果
            formatted_results = []
            for i in range(len(results['ids'][0])):
                # ChromaDB使用L2距离，距离越小越相似
                # L2距离对高维向量来说数值较大，需要合适的转换公式
                distance = results['distances'][0][i]
                
                # 使用更宽容的转换公式：similarity = 1 / (1 + distance/10)
                # 这样：distance=0 → 100%, distance=10 → 50%, distance=20 → 33%
                if distance < 0:
                    similarity = 0.0
                else:
                    similarity = 1.0 / (1.0 + distance / 10.0)
                
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i] if results['metadatas'][0][i] else {},
                    "similarity": similarity
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
    
    def delete_document(self, doc_id: str, course_id: Optional[str] = None) -> bool:
        """
        删除文档
        
        Args:
            doc_id: 文档ID
            course_id: 课程ID（如果提供，将从对应课程的专属集合中删除）
            
        Returns:
            是否删除成功
        """
        try:
            # 确定使用哪个集合
            if course_id:
                collection = self.get_course_collection(course_id)
            else:
                collection = self.collection
            
            collection.delete(ids=[doc_id])
            return True
        except Exception as e:
            print(f"删除文档失败: {e}")
            return False
    
    def delete_course_collection(self, course_id: str) -> bool:
        """
        删除整个课程的知识库集合
        当课程被删除时可以调用此方法清理数据
        
        Args:
            course_id: 课程ID
            
        Returns:
            是否删除成功
        """
        try:
            collection_name = f"course_{course_id.replace('-', '_')}"
            self.client.delete_collection(name=collection_name)
            
            # 从缓存中移除
            if course_id in self._course_collections:
                del self._course_collections[course_id]
            
            print(f"✅ 已删除课程知识库集合: {collection_name}")
            return True
        except Exception as e:
            print(f"❌ 删除课程集合失败: {e}")
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
    
    def get_stats(self, course_id: Optional[str] = None) -> Dict[str, Any]:
        """
        获取数据库统计信息
        
        Args:
            course_id: 课程ID（如果提供，返回该课程集合的统计信息）
        
        Returns:
            统计信息
        """
        try:
            if course_id:
                collection = self.get_course_collection(course_id)
            else:
                collection = self.collection
            
            count = collection.count()
            return {
                "total_documents": count,
                "collection_name": collection.name,
                "metadata": collection.metadata
            }
        except Exception as e:
            print(f"获取统计信息失败: {e}")
            return {"total_documents": 0}
    
    def get_all_course_collections(self) -> List[Dict[str, Any]]:
        """
        获取所有课程知识库集合的列表
        
        Returns:
            课程集合信息列表
        """
        try:
            all_collections = self.client.list_collections()
            course_collections = []
            
            for collection in all_collections:
                # 只返回课程集合（以 course_ 开头）
                if collection.name.startswith("course_"):
                    course_collections.append({
                        "name": collection.name,
                        "metadata": collection.metadata,
                        "count": collection.count()
                    })
            
            return course_collections
        except Exception as e:
            print(f"获取课程集合列表失败: {e}")
            return []
    
    def search_all_courses(
        self,
        query: str,
        n_results: int = 5,
        course_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        在所有课程的知识库中搜索（全局知识库）
        
        Args:
            query: 查询文本
            n_results: 每个课程返回的最大结果数
            course_ids: 指定要搜索的课程ID列表（None表示搜索所有课程）
            
        Returns:
            所有课程的搜索结果，按相似度排序
        """
        try:
            all_results = []
            
            # 获取所有课程集合
            if course_ids:
                # 搜索指定的课程
                collections_to_search = [self.get_course_collection(cid) for cid in course_ids]
            else:
                # 搜索所有已知的课程集合
                all_colls = self.client.list_collections()
                collections_to_search = [c for c in all_colls if c.name.startswith("course_")]
            
            for collection in collections_to_search:
                # 生成查询向量
                query_embedding = [self._get_embedding(query)]
                
                # 查询单个集合
                results = collection.query(
                    query_embeddings=query_embedding,
                    n_results=n_results,
                    include=["documents", "metadatas", "distances"]
                )
                
                # 格式化并合并结果
                for i in range(len(results['ids'][0])):
                    distance = results['distances'][0][i]
                    similarity = 1.0 / (1.0 + distance / 10.0)
                    
                    all_results.append({
                        "id": results['ids'][0][i],
                        "content": results['documents'][0][i],
                        "metadata": results['metadatas'][0][i],
                        "similarity": similarity,
                        "course_id": collection.metadata.get("course_id", "unknown")
                    })
            
            # 按相似度从高到低排序
            all_results.sort(key=lambda x: x['similarity'], reverse=True)
            
            # 返回前 n_results 个结果
            return all_results[:n_results]
            
        except Exception as e:
            print(f"全局搜索失败: {e}")
            return []

    def upsert_documents(self, documents: List[Dict[str, Any]], course_id: Optional[str] = None):
        """批量更新或插入文档"""
        try:
            # 确定使用哪个集合
            if course_id:
                collection = self.get_course_collection(course_id)
            else:
                collection = self.collection

            ids = []
            contents = []
            embeddings = []
            metadatas = []

            for doc in documents:
                doc_id = doc.get("id") or str(uuid.uuid4())
                content = doc["content"]
                metadata = doc.get("metadata", {})
                
                ids.append(doc_id)
                contents.append(content)
                embeddings.append(self._get_embedding(content))
                metadatas.append(metadata)

            collection.upsert(
                ids=ids,
                documents=contents,
                embeddings=embeddings,
                metadatas=metadatas
            )
            print(f"✅ 成功插入/更新 {len(ids)} 个文档块")
        except Exception as e:
            print(f"❌ 批量更新文档失败: {e}")
            raise

    def search_relevant_context(self, query: str, n_results: int = 3, course_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """搜索相关的上下文片段"""
        return self.search_similar(query, n_results=n_results, course_id=course_id)
    def get_global_stats(self) -> Dict[str, Any]:
        """
        获取全局知识库统计信息（所有课程的汇总）
        
        Returns:
            全局统计信息
        """
        try:
            course_collections = self.get_all_course_collections()
            
            total_documents = sum(coll['count'] for coll in course_collections)
            total_courses = len(course_collections)
            
            # 按文档数量排序
            course_collections.sort(key=lambda x: x['count'], reverse=True)
            
            return {
                "total_documents": total_documents,
                "total_courses": total_courses,
                "course_collections": course_collections,
                "average_docs_per_course": total_documents / total_courses if total_courses > 0 else 0
            }
        except Exception as e:
            print(f"获取全局统计信息失败: {e}")
            return {
                "total_documents": 0,
                "total_courses": 0,
                "course_collections": [],
                "average_docs_per_course": 0
            }


# 创建全局实例（懒加载）
_vector_db_instance = None

def get_vector_db() -> VectorDBService:
    """获取向量数据库实例（单例模式）"""
    global _vector_db_instance
    if _vector_db_instance is None:
        _vector_db_instance = VectorDBService()
    return _vector_db_instance
