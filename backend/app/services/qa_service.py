import os
import logging
import uuid
import json
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime
from openai import OpenAI

from app.models.qa import QASession, QARecord
from app.services.document_parser import DocumentParser
from app.services.vector_db_service import VectorDBService
from app.services.skill_loader import SkillLoader

class QAService:
    """
    智能问答服务 - 核心业务逻辑类
    负责处理用户上传的文件（解析、切分、入库）以及与 AI 模型的交互。
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # 初始化解析器（用于读取文件）
        self.parser = DocumentParser()
        # 初始化向量数据库服务（用于存储和搜索知识）
        self.vector_db = VectorDBService()
        # 初始化技能加载器（用于获取 AI 助手的行为模板）
        self.skill_loader = SkillLoader()
        self.skill_loader.load_skills()
        
        # AI 客户端配置 (参考 SurveyGenerationService)
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)

    async def process_file_upload(self, file_path: Path, student_id: str) -> Dict[str, Any]:
        """
        处理用户上传的文件全流程：解析 -> 智能分块 -> 存入向量库
        
        Args:
            file_path: 上传文件的存储路径
            student_id: 上传者的 ID
            
        Returns:
            Dict: 包含处理结果（成功/失败、块数量等）
        """
        try:
            # 1. 调用解析器将文件（如 PDF）转换为 Markdown 文本
            self.logger.info(f"正在解析文件: {file_path}")
            raw_chunks = self.parser.parse_file(file_path)
            
            # 2. 将长文本进行智能切分，防止超过 AI 的处理限额
            processed_chunks = self._smart_split(raw_chunks)
            
            # 3. 将切分好的文本块存入向量数据库，以便后续搜索
            # 注意：如果向量库已经实现了 upsert_documents 方法则调用它
            if hasattr(self.vector_db, 'upsert_documents'):
                self.vector_db.upsert_documents(processed_chunks)
            
            return {
                "success": True,
                "chunk_count": len(processed_chunks),
                "filename": file_path.name
            }
        except Exception as e:
            self.logger.error(f"处理文件上传失败: {e}")
            return {"success": False, "error": str(e)}

    def _smart_split(self, raw_chunks: List[Dict], chunk_size: int = 800, overlap: int = 150) -> List[Dict]:
        """
        滑动窗口切分算法：将长文本切成小段，并保持段落间有重叠。
        
        Args:
            raw_chunks: 原始文本数据
            chunk_size: 每个分块的最大字数（默认 800 字）
            overlap: 分块之间的重叠字数（默认 150 字，防止知识点被拦腰切断）
            
        Returns:
            List[Dict]: 切分后的文本块列表
        """
        final_chunks = []
        for raw in raw_chunks:
            content = raw["content"]
            metadata = raw["metadata"]
            
            # 如果文本本身就很短，无需切分
            if len(content) <= chunk_size:
                final_chunks.append(raw)
                continue
            
            # 使用滑动窗口进行切分
            start = 0
            while start < len(content):
                end = start + chunk_size
                chunk_text = content[start:end]
                
                final_chunks.append({
                    "content": chunk_text,
                    "metadata": {**metadata, "chunk_index": len(final_chunks)}
                })
                
                # 窗口向前移动 (步长 = 块大小 - 重叠大小)
                start += (chunk_size - overlap)
                
        return final_chunks

    async def get_ai_answer(self, question: str, session_id: str, student_id: str) -> Dict[str, Any]:
        """
        获取 AI 的智能回答：检索知识 -> 匹配技能 -> 生成文本
        """
        try:
            # 1. 从向量库中检索与问题最相关的知识片段
            context = ""
            sources = []
            if hasattr(self.vector_db, 'search_relevant_context'):
                search_results = self.vector_db.search_relevant_context(question)
                # 提取内容用于 Prompt
                context_list = []
                for r in search_results:
                    content = r["content"]
                    source_name = r["metadata"].get("filename", "未知来源")
                    context_list.append(f"--- 来源: {source_name} ---\n{content}")
                    sources.append(r["metadata"])
                
                context = "\n\n".join(context_list)

            # 2. 获取预定义的“智能问答专家”技能模板
            skill = self.skill_loader.get_skill_by_name("智能问答专家") or \
                    self.skill_loader.get_skill_by_name("智能问答专家 (QA Expert)")
            
            system_prompt = skill.content if skill else "你是一个专业的教学助手。"
            
            # 3. 构建用户 Prompt
            user_prompt = f"""
请基于以下【参考知识】回答我的问题。

【参考知识】：
{context if context else "未找到相关知识库内容，请基于你的通用知识回答。"}

【我的问题】：
{question}
"""

            # 4. 调用 AI 模型
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3, # 降低随机性，确保回答严谨
                stream=False
            )
            
            answer = response.choices[0].message.content

            return {
                "answer": answer,
                "sources": sources,
                "session_id": session_id
            }
        except Exception as e:
            self.logger.error(f"AI 生成回答失败: {e}")
            return {
                "answer": f"抱歉，生成回答时遇到了问题: {str(e)}",
                "sources": [],
                "session_id": session_id
            }

    async def create_session(self, student_id: str, title: str) -> str:
        """创建问答会话"""
        session_id = str(uuid.uuid4())
        # TODO: 存入数据库
        return session_id

qa_service = QAService()
