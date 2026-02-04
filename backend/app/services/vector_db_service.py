"""
向量数据库服务
使用 LlamaIndex + ChromaDB 实现 RAG

架构：
- 核心：LlamaIndex (VectorStoreIndex)
- 存储：ChromaDB (Persistent)
- 模型：HuggingFace Embedding (本地) + OpenAI LLM (远程)
- 结构：每个课程对应一个 Chroma Collection -> 一个 VectorStoreIndex
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional
import os
from datetime import datetime
from pathlib import Path

# LlamaIndex 核心组件
from llama_index.core import (
    VectorStoreIndex, 
    Document, 
    Settings, 
    StorageContext,
    load_index_from_storage
)
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.core.query_engine import CitationQueryEngine

class VectorDBService:
    """基于 LlamaIndex 的向量数据库服务"""
    
    def __init__(self):
        try:
            # 1. 路径配置
            backend_dir = Path(__file__).resolve().parent.parent.parent
            db_path = backend_dir / "data" / "chroma_db"
            db_path.mkdir(parents=True, exist_ok=True)
            print(f"向量数据库路径: {db_path}")
            
            # 2. 初始化 Chroma 客户端
            self.client = chromadb.PersistentClient(
                path=str(db_path),
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            
            # 3. 配置全局 Settings (LlamaIndex v0.10+)
            print("正在初始化 LlamaIndex 模型配置...")
            
            # Embedding 模型 (保持与原项目一致，使用本地 HuggingFace 模型)
            # cache_folder 可以指定模型缓存路径，避免重复下载
            self.embed_model = HuggingFaceEmbedding(
                model_name="paraphrase-multilingual-MiniLM-L12-v2"
            )
            Settings.embed_model = self.embed_model
            
            # LLM 配置 (使用 OpenAI)
            # 注意：需要环境变量 OPENAI_API_KEY
            self.llm = OpenAI(model="gpt-3.5-turbo", temperature=0)
            Settings.llm = self.llm
            
            print("LlamaIndex 配置完成")
            
            # 4. 索引缓存
            self._indices = {} # course_id -> VectorStoreIndex
            self._query_engines = {} # course_id -> QueryEngine
            
            # 5. 初始化默认/问卷集合
            self.survey_collection_name = "survey_documents"
            self._init_collection(self.survey_collection_name, "问卷文档知识库")
            
        except Exception as e:
            print(f"向量数据库初始化失败: {e}")
            raise

    def _init_collection(self, name: str, description: str) -> None:
        """初始化 Chroma 集合"""
        self.client.get_or_create_collection(
            name=name,
            metadata={"description": description}
        )

    def get_index(self, course_id: Optional[str] = None) -> VectorStoreIndex:
        """
        获取指定课程的索引对象
        如果不存在则自动创建并连接到对应的 Chroma Collection
        """
        # 确定集合名称
        if course_id:
            collection_name = f"course_{course_id.replace('-', '_')}"
            desc = f"课程 {course_id} 的专属知识库"
        else:
            collection_name = self.survey_collection_name
            desc = "问卷文档知识库"
            
        # 检查缓存
        if collection_name in self._indices:
            return self._indices[collection_name]
            
        try:
            # 获取 Chroma Collection
            chroma_collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"description": desc, "created_at": datetime.now().isoformat()}
            )
            
            # 创建 Vector Store
            vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            
            # 从 Vector Store 加载索引 (如果集合为空，这会创建一个空索引)
            index = VectorStoreIndex.from_vector_store(
                vector_store,
                storage_context=storage_context,
                embed_model=self.embed_model
            )
            
            # 缓存
            self._indices[collection_name] = index
            return index
            
        except Exception as e:
            print(f"获取索引失败 [{collection_name}]: {e}")
            raise

    def add_document(
        self, 
        doc_id: str, 
        content: str, 
        metadata: Optional[Dict[str, Any]] = None,
        course_id: Optional[str] = None
    ) -> bool:
        """
        添加文档到 LlamaIndex
        """
        try:
            if metadata is None:
                metadata = {}
            
            # 确保元数据中包含便于引用的字段
            metadata['doc_id'] = doc_id
            metadata['indexed_at'] = datetime.now().isoformat()
            
            # 创建 LlamaIndex 文档对象
            doc = Document(
                text=content,
                metadata=metadata,
                id_=doc_id
            )
            
            # 获取索引并插入
            index = self.get_index(course_id)
            index.insert(doc)
            
            print(f"文档已添加: {doc_id} (Course: {course_id})")
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
        原生检索 (Retriever 模式)，不经过 LLM 生成
        用于保持向后兼容性
        """
        try:
            index = self.get_index(course_id)
            
            # 配置 Retriever
            # 注意：LlamaIndex 的 vector_store_kwargs 可以传 filter
            vector_store_kwargs = {}
            if filter_metadata:
                vector_store_kwargs["where"] = filter_metadata

            retriever = index.as_retriever(
                similarity_top_k=n_results,
                vector_store_kwargs=vector_store_kwargs
            )
            
            nodes = retriever.retrieve(query)
            
            results = []
            for node in nodes:
                results.append({
                    "id": node.node_id,
                    "content": node.text,
                    "metadata": node.metadata,
                    "similarity": node.score or 0.0
                })
                
            return results
            
        except Exception as e:
            print(f"检索失败: {e}")
            return []

    def get_citation_query_engine(self, course_id: Optional[str] = None, similarity_top_k: int = 3):
        """
        获取带引用功能的查询引擎
        这是 LlamaIndex 的核心功能之一
        """
        index = self.get_index(course_id)
        
        # 创建 CitationQueryEngine
        # 它会自动检索，并让 LLM 生成带有引用的回答
        query_engine = CitationQueryEngine.from_args(
            index,
            similarity_top_k=similarity_top_k,
            citation_chunk_size=512, # 引用块的大小
        )
        return query_engine
        
    def delete_document(self, doc_id: str, course_id: Optional[str] = None) -> bool:
        """删除文档"""
        try:
            index = self.get_index(course_id)
            index.delete_ref_doc(doc_id, delete_from_docstore=True)
            return True
        except Exception as e:
            print(f"删除文档失败: {e}")
            # 如果 LlamaIndex 删除失败（可能是旧数据），尝试直接操作 Chroma
            try:
                if course_id:
                    c_name = f"course_{course_id.replace('-', '_')}"
                else:
                    c_name = self.survey_collection_name
                self.client.get_collection(c_name).delete(ids=[doc_id])
                return True
            except Exception as e2:
                print(f"Chroma直接删除也失败: {e2}")
                return False

    def delete_course_collection(self, course_id: str) -> bool:
        """删除课程集合"""
        try:
            collection_name = f"course_{course_id.replace('-', '_')}"
            self.client.delete_collection(name=collection_name)
            
            if collection_name in self._indices:
                del self._indices[collection_name]
                
            print(f"✅ 已删除课程知识库集合: {collection_name}")
            return True
        except Exception as e:
            print(f"❌ 删除课程集合失败: {e}")
            return False

# 全局单例
# vector_db = VectorDBService() 
# 注意：我们不在模块级别实例化，而是在使用时实例化，避免导入时的副作用
