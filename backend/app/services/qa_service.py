from typing import List, Optional, Dict, Any, Tuple
import json
import uuid
import os
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.qa import QARecord
from app.services.vector_db_service import get_vector_db
from app.services.skill_loader import SkillLoader, GeneratedSkill

# LlamaIndex 导入（条件导入）
try:
    from llama_index.core import Settings
    from llama_index.llms.openai import OpenAI
    LLAMA_INDEX_AVAILABLE = True
except ImportError:
    print("⚠️  警告: 无法导入 LlamaIndex，Agent功能将受限")
    print("💡 提示: 如需启用完整Agent功能，请安装 llama-index 相关包")
    LLAMA_INDEX_AVAILABLE = False
    Settings = None
    OpenAI = None

class QAService:
    """问答服务 - 基于 LlamaIndex RAG + DeepSeek API"""
    
    def __init__(self):
        # DeepSeek API配置
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        
        # 初始化向量数据库
        self.vector_db = get_vector_db()
        
        # 初始化技能加载器
        backend_dir = Path(__file__).resolve().parent.parent.parent
        skills_dir = backend_dir / "skills"
        self.skill_loader = SkillLoader(skills_dir)
        self.skill_loader.load_skills()
        
        # 初始化DeepSeek LLM
        try:
            from openai import OpenAI
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
            self.llm_available = True
            print(f"✅ DeepSeek客户端初始化成功: {self.base_url}")
        except Exception as e:
            print(f"⚠️  无法初始化DeepSeek客户端: {e}")
            self.llm_available = False
        
        # 为技能构建向量
        if LLAMA_INDEX_AVAILABLE:
            self.skill_loader.build_skill_embeddings()
    
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
        获取AI答案 - 基于知识库检索 + 技能调用 + DeepSeek生成
        """
        try:
            # 1. 准备工具集合
            tools = []
            
            # 1.1 添加知识库工具
            if self.vector_db and self.vector_db.available:
                query_engine = self.vector_db.get_citation_query_engine(course_id)
                if query_engine:
                    tools.append({
                        "type": "knowledge_base",
                        "name": "query_knowledge_base",
                        "description": "查询课程知识库，获取相关文档和引用",
                        "engine": query_engine
                    })
            
            # 1.2 语义检索静态技能
            if LLAMA_INDEX_AVAILABLE:
                matched_skills = self.skill_loader.search_skills(question, top_k=3, threshold=0.35)
                for skill, score in matched_skills:
                    tools.append({
                        "type": "skill",
                        "name": skill.name,
                        "description": skill.description,
                        "skill": skill,
                        "score": score
                    })
            
            # 1.3 Planner决策
            planner_result = self._planner_decide(question)
            
            # 1.4 判定并生成临时技能
            if planner_result.get("should_generate_runtime"):
                runtime_skill = self.skill_loader.generate_runtime_skill(question)
                if runtime_skill:
                    tools.append({
                        "type": "runtime_skill",
                        "name": runtime_skill.name,
                        "description": runtime_skill.description,
                        "fn": runtime_skill.fn
                    })
            
            # 2. 调用DeepSeek API生成答案
            if self.llm_available:
                try:
                    answer = await self._call_deepseek_with_tools(question, history, tools)
                except Exception as e:
                    print(f"⚠️  DeepSeek API调用失败，使用模拟答案: {e}")
                    mock_result = self._get_mock_answer(question)
                    answer = mock_result.get("answer", "")
            else:
                # 如果DeepSeek不可用，使用模拟答案
                mock_result = self._get_mock_answer(question)
                answer = mock_result.get("answer", "")
            
            # 3. 收集引用与结果
            sources = []
            if self.vector_db and self.vector_db.available:
                # 从知识库检索相关文档
                kb_results = self.vector_db.search_similar(question, n_results=3, course_id=course_id)
                for result in kb_results:
                    sources.append({
                        "content": result.get("content", ""),
                        "file_name": result.get("metadata", {}).get("file_name", ""),
                        "page_label": result.get("metadata", {}).get("page_label", ""),
                        "score": result.get("similarity", 0.0)
                    })
            
            return {
                "answer": answer,
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
    
    async def _call_deepseek_with_tools(
        self,
        question: str,
        history: List[dict],
        tools: List[dict]
    ) -> str:
        """
        调用DeepSeek API生成答案（带工具调用）
        """
        try:
            # 1. 准备系统提示词
            system_prompt = (
                "你是一个智能教学助手。你的目标是帮助学生解答问题。\n"
                "1. 回答要亲切、准确、有条理。\n"
                "2. 如果有可用的工具（知识库、技能等），优先使用工具获取信息。\n"
                "3. 如果问题涉及编程、数学或其他技术问题，请提供详细的解释和示例。\n"
                "4. 在回答中引用知识库来源时，请明确标注来源。\n"
            )
            
            # 2. 准备对话历史
            messages = [{"role": "system", "content": system_prompt}]
            
            # 添加历史对话
            if history:
                for msg in history:
                    messages.append({
                        "role": msg['role'],
                        "content": msg['content']
                    })
            
            # 3. 添加当前问题和工具信息
            tool_info = "\n".join([
                f"- {tool['name']}: {tool['description']}"
                for tool in tools
            ])
            
            messages.append({
                "role": "user",
                "content": f"问题：{question}\n\n可用工具：\n{tool_info}"
            })
            
            print(f"📤 调用DeepSeek API: {self.base_url}")
            print(f"📤 模型: {self.model_name}")
            print(f"📤 消息数量: {len(messages)}")
            
            # 4. 调用 DeepSeek API
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            
            # 5. 提取答案
            answer = response.choices[0].message.content

            print(f"✅ DeepSeek API调用成功，答案长度: {len(answer)}")
            return answer
            
        except Exception as e:
            print(f"❌ 调用DeepSeek API失败: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _planner_decide(self, question: str) -> Dict[str, Any]:
        """
        Planner决策 - 判断是否需要使用现有技能或生成临时技能
        """
        # 简单启发式规则判断
        q = question.lower()
        
        # 检查是否需要计算
        if any(keyword in q for keyword in ["计算", "求", "百分比", "比例", "+", "-", "*", "/", "%"]):
            return {
                "should_use_existing": True,
                "matched_skill_names": ["AutoMathCalculator"],
                "should_generate_runtime": True,
                "runtime_type": "math_calc"
            }
        
        # 检查是否需要时间查询
        if any(keyword in q for keyword in ["时间", "日期", "现在几点"]):
            return {
                "should_use_existing": True,
                "matched_skill_names": ["TimeQuery"],
                "should_generate_runtime": False,
                "runtime_type": "none"
            }
        
        # 默认情况
        return {
            "should_use_existing": False,
            "matched_skill_names": [],
            "should_generate_runtime": False,
            "runtime_type": "none"
        }
    
    def _get_mock_answer(self, question: str) -> Dict[str, Any]:
        """
        生成模拟答案
        """
        # 根据问题内容生成不同的回答
        question_lower = question.lower()
        
        if "python" in question_lower:
            answer = (
                "Python是一种高级编程语言，由Guido van Rossum于1991年首次发布。\n\n"
                "Python的特点包括：\n"
                "1. 语法简洁易读\n"
                "2. 支持多种编程范式（面向对象、函数式、过程式）\n"
                "3. 丰富的标准库和第三方库\n"
                "4. 跨平台支持\n\n"
                "Python广泛应用于Web开发、数据分析、人工智能、自动化脚本等领域。\n\n"
                "示例代码：\n"
                "```python\n"
                "print('Hello, World!')\n"
                "```"
            )
        elif "java" in question_lower:
            answer = (
                "Java是一种面向对象的编程语言，由Sun Microsystems（现为Oracle）于1995年发布。\n\n"
                "Java的特点包括：\n"
                "1. 跨平台（一次编写，到处运行）\n"
                "2. 面向对象\n"
                "3. 自动内存管理（垃圾回收）\n"
                "4. 强大的生态系统\n\n"
                "Java广泛应用于企业级应用、Android开发、大数据处理等领域。\n\n"
                "示例代码：\n"
                "```java\n"
                "public class HelloWorld {\n"
                "    public static void main(String[] args) {\n"
                "        System.out.println(\"Hello, World!\");\n"
                "    }\n"
                "}\n"
                "```"
            )
        elif "javascript" in question_lower:
            answer = (
                "JavaScript是一种脚本语言，最初由Netscape的Brendan Eich于1995年创建。\n\n"
                "JavaScript的特点包括：\n"
                "1. 动态类型\n"
                "2. 事件驱动\n"
                "3. 函数式编程支持\n"
                "4. 广泛的浏览器支持\n\n"
                "JavaScript主要用于Web前端开发，也可以用于后端（Node.js）和移动应用开发。\n\n"
                "示例代码：\n"
                "```javascript\n"
                "console.log('Hello, World!');\n"
                "```"
            )
        else:
            answer = (
                f"感谢您的问题：\"{question}\"\n\n"
                "我是一个智能教学助手，可以帮助您解答各种问题，包括：\n"
                "1. 编程语言（Python、Java、JavaScript等）\n"
                "2. 算法和数据结构\n"
                "3. 软件开发\n"
                "4. 其他技术问题\n\n"
                "请提供更多详细信息，我会尽力为您提供准确的答案。"
            )
        
        return {
            "answer": answer,
            "sources": []
        }

qa_service = QAService()