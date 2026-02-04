from typing import List, Optional, Dict, Any
import json
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.qa import QARecord
from app.services.vector_db_service import VectorDBService
from llama_index.agent.openai import OpenAIAgent
from llama_index.core.tools import QueryEngineTool, ToolMetadata, FunctionTool
from llama_index.core.llms import ChatMessage, MessageRole
from app.skills import AVAILABLE_SKILLS
from app.services.skill_loader import SkillLoader
from llama_index.core import Settings
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

class QAService:
    """问答服务 - 基于 LlamaIndex Agent"""
    
    def __init__(self):
        self.vector_db = VectorDBService()
        self.skill_loader = SkillLoader()
        try:
            self.skill_loader.load_skills()
            self.skill_loader.build_skill_embeddings()
        except Exception:
            pass
        self._embed_model = Settings.embed_model or HuggingFaceEmbedding(model_name="paraphrase-multilingual-MiniLM-L12-v2")
        self._py_skills = AVAILABLE_SKILLS
        self._py_skill_embeddings = {}
        self._func_by_name = {getattr(f, "__name__", f"skill_{i}"): f for i, f in enumerate(self._py_skills)}
        try:
            texts = []
            for f in self._py_skills:
                name = getattr(f, "__name__", "unknown")
                desc = getattr(f, "__doc__", "") or ""
                texts.append(f"{name}\n{desc}")
            if texts:
                vecs = self._embed_model.get_text_embedding_batch(texts)
                for f, v in zip(self._py_skills, vecs):
                    self._py_skill_embeddings[f] = v
        except Exception:
            pass
    
    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(y * y for y in b) ** 0.5
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)
    
    def _select_static_skills(self, question: str, top_k: int = 3, threshold: float = 0.35) -> List:
        try:
            qv = self._embed_model.get_text_embedding(question)
        except Exception:
            return []
        scored = []
        for f in self._py_skills:
            sv = self._py_skill_embeddings.get(f)
            if not sv:
                continue
            sim = self._cosine(sv, qv)
            if sim >= threshold:
                scored.append((f, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [f for f, _ in scored[:top_k]]
    
    def _planner_decide(self, question: str) -> Dict[str, Any]:
        try:
            if Settings.llm is not None:
                catalog = []
                for name, func in self._func_by_name.items():
                    desc = getattr(func, "__doc__", "") or ""
                    catalog.append({"name": name, "description": desc})
                prompt = (
                    "你是工具选择规划器。根据问题与可用技能列表，输出严格的JSON决策。\n"
                    "字段: should_use_existing(bool), matched_skill_names(list[str]≤3), "
                    "should_generate_runtime(bool), runtime_type(str: 'math_calc'|'none').\n"
                    "只输出JSON，不要任何解释。\n"
                    f"问题: {question}\n"
                    f"技能: {json.dumps(catalog, ensure_ascii=False)}\n"
                )
                resp = Settings.llm.complete(prompt)
                text = getattr(resp, "text", "") or str(resp)
                data = json.loads(text)
                matched_names = data.get("matched_skill_names") or []
                selected_funcs = []
                for n in matched_names:
                    f = self._func_by_name.get(n)
                    if f:
                        selected_funcs.append(f)
                runtime_skill = None
                gen = bool(data.get("should_generate_runtime"))
                rt = data.get("runtime_type")
                if gen and rt == "math_calc":
                    runtime_skill = self.skill_loader.generate_runtime_skill(question)
                return {"selected_funcs": selected_funcs, "runtime_skill": runtime_skill}
        except Exception:
            pass
        selected_funcs = self._select_static_skills(question)
        runtime_skill = self.skill_loader.generate_runtime_skill(question)
        return {"selected_funcs": selected_funcs, "runtime_skill": runtime_skill}
        
    async def create_qa_record(
        self, 
        db: Session, 
        student_id: str, 
        question: str, 
        answer: str,
        course_id: Optional[str] = None,
        sources: Optional[List[Dict]] = None
    ) -> QARecord:
        """
        创建问答记录
        """
        try:
            # 转换 sources 为 JSON 格式
            knowledge_sources = sources if sources else []
            
            db_record = QARecord(
                student_id=student_id,
                course_id=course_id,
                question=question,
                answer=answer,
                answer_type="ai",
                knowledge_sources=knowledge_sources,
                # 其他字段使用默认值
            )
            db.add(db_record)
            db.commit()
            db.refresh(db_record)
            return db_record
        except Exception as e:
            print(f"创建问答记录失败: {e}")
            db.rollback()
            return None
    
    async def get_student_history(
        self, 
        db: Session, 
        student_id: str, 
        limit: int = 20
    ) -> List[QARecord]:
        """
        获取学生的问答历史
        """
        return db.query(QARecord)\
            .filter(QARecord.student_id == student_id)\
            .order_by(desc(QARecord.created_at))\
            .limit(limit)\
            .all()
    
    async def get_ai_answer(
        self, 
        question: str, 
        course_id: Optional[str] = None, 
        history: List[dict] = None
    ) -> Dict[str, Any]:
        """
        调用 AI Agent 获取答案
        
        Args:
            question: 用户问题
            course_id: 当前课程ID (用于加载对应知识库)
            history: 历史对话记录List[dict(role, content)]
            
        Returns:
            Dict containing:
            - answer: str
            - sources: List[dict] (引用来源)
        """
        try:
            # 1. 准备工具集 (Tools)
            tools = []
            
            # (A) 知识库工具
            if course_id:
                # 获取该课程的 CitationQueryEngine
                query_engine = self.vector_db.get_citation_query_engine(course_id)
                
                # 包装成 Tool
                kb_tool = QueryEngineTool(
                    query_engine=query_engine,
                    metadata=ToolMetadata(
                        name="course_knowledge_base",
                        description=(
                            f"查询课程 {course_id} 的专业知识库。"
                            "当用户询问关于课程内容、概念定义、具体知识点时，必须优先使用此工具。"
                            "工具会返回带有引用的详细信息。"
                        )
                    )
                )
                tools.append(kb_tool)
            
            plan = self._planner_decide(question)
            for skill_func in plan.get("selected_funcs", []):
                try:
                    tools.append(FunctionTool.from_defaults(fn=skill_func))
                except Exception:
                    pass
            runtime_skill = plan.get("runtime_skill")
            if runtime_skill:
                try:
                    tools.append(FunctionTool.from_defaults(fn=runtime_skill.fn))
                except Exception:
                    pass
            
            # 2. 初始化 Agent
            # 使用 OpenAIAgent (利用 GPT 的 Function Calling 能力)
            system_prompt = (
                "你是一个智能教学助手。你的目标是帮助学生解答问题。"
                "你可以访问课程知识库和其他工具。"
                "1. 如果问题涉及课程内容，请务必查询知识库，并引用来源。"
                "2. 如果问题涉及计算，请使用计算工具。"
                "3. 回答要亲切、准确、有条理。"
            )
            
            # 转换历史记录格式
            chat_history = []
            if history:
                for msg in history:
                    role = MessageRole.USER if msg['role'] == 'user' else MessageRole.ASSISTANT
                    chat_history.append(ChatMessage(role=role, content=msg['content']))
            
            agent = OpenAIAgent.from_tools(
                tools, 
                system_prompt=system_prompt,
                chat_history=chat_history,
                verbose=True
            )
            
            # 3. 执行对话
            response = await agent.achat(question)
            
            # 4. 提取来源信息
            sources = []
            if hasattr(response, 'source_nodes'):
                for node in response.source_nodes:
                    # 提取元数据
                    meta = node.metadata if node.metadata else {}
                    sources.append({
                        "content": node.node.get_content()[:200] + "...", # 截取一部分内容
                        "score": node.score,
                        "file_name": meta.get("file_name", "Unknown"),
                        "page_label": meta.get("page_label", "N/A")
                    })

            # LlamaIndex 的 str(response) 默认已包含格式化的引用，但我们可能想要纯净的回答 + 结构化来源
            # 这里的 response.response 通常是带引用的文本
            
            return {
                "answer": str(response),
                "sources": sources
            }
            
        except Exception as e:
            print(f"AI 回答生成失败: {e}")
            import traceback
            traceback.print_exc()
            return {
                "answer": "抱歉，我现在无法回答您的问题，请稍后再试。",
                "sources": []
            }

qa_service = QAService()
