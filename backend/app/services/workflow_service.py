"""
工作流编排服务 - 智能问答核心引擎

实现完整的工作流：意图识别 → 知识检索 → Skill匹配（支持动态生成） → 回答生成
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
from openai import OpenAI

from app.services.skill_loader import SkillLoader, Skill
from app.services.vector_db_service import get_vector_db


class IntentType(Enum):
    """用户意图类型"""
    CONCEPT_QUESTION = "concept_question"       # 概念解释类问题
    CODE_ANALYSIS = "code_analysis"             # 代码分析类问题
    PROBLEM_SOLVING = "problem_solving"         # 问题解决类
    LEARNING_ADVICE = "learning_advice"         # 学习建议类
    ESSAY_GRADING = "essay_grading"             # 作文批改类
    SURVEY_GENERATION = "survey_generation"     # 问卷生成类
    CUSTOM_TASK = "custom_task"                 # 自定义任务（需要动态Skill）
    GENERAL_CHAT = "general_chat"               # 一般对话


@dataclass
class WorkflowContext:
    """工作流上下文"""
    question: str
    session_id: str
    student_id: str
    intent: Optional[IntentType] = None
    keywords: List[str] = None
    knowledge_context: str = ""
    knowledge_sources: List[Dict] = None
    selected_skill: Optional[Skill] = None
    answer: str = ""
    
    def __post_init__(self):
        if self.keywords is None:
            self.keywords = []
        if self.knowledge_sources is None:
            self.knowledge_sources = []


class WorkflowService:
    """
    工作流编排服务
    
    负责协调各个处理节点，实现智能问答的完整流程
    支持动态Skill生成：当问题不匹配现有Skill时，自动创建临时Skill
    """
    
    # 意图与 Skill 的映射关系
    INTENT_SKILL_MAP = {
        IntentType.CONCEPT_QUESTION: "概念讲解专家",
        IntentType.CODE_ANALYSIS: "代码分析专家",
        IntentType.PROBLEM_SOLVING: "智能问答专家",
        IntentType.LEARNING_ADVICE: "学习计划生成",
        IntentType.ESSAY_GRADING: "作文批改专家",
        IntentType.SURVEY_GENERATION: "问卷生成专家",
        IntentType.CUSTOM_TASK: None,  # 需要动态生成
        IntentType.GENERAL_CHAT: "智能问答专家",
    }
    
    # 意图识别的关键词
    INTENT_KEYWORDS = {
        IntentType.CONCEPT_QUESTION: [
            "什么是", "是什么", "定义", "概念", "原理", "区别", "和.*有什么不同",
            "解释", "含义", "意思", "为什么叫", "什么叫"
        ],
        IntentType.CODE_ANALYSIS: [
            "代码", "程序", "函数", "bug", "错误", "报错", "运行", "执行",
            "这段", "优化", "重构", "调试", "debug", "实现", "写一个"
        ],
        IntentType.LEARNING_ADVICE: [
            "怎么学", "如何学", "学习方法", "学习计划", "推荐", "建议", "入门",
            "路径", "资源", "书籍", "教程", "从哪里开始"
        ],
        IntentType.ESSAY_GRADING: [
            "作文", "批改", "评分", "修改", "文章", "写作", "essay", "评价文章"
        ],
        IntentType.SURVEY_GENERATION: [
            "问卷", "调查", "survey", "调研", "生成问卷", "设计问卷"
        ],
    }
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # 初始化 AI 客户端
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        
        # 初始化 Skill 加载器（包括动态Skill）
        self.skill_loader = SkillLoader()
        self.skill_loader.load_skills()
        self.skill_loader.load_dynamic_skills()  # 加载已保存的动态Skill
        
        # 初始化向量数据库
        self.vector_db = get_vector_db()
    
    async def execute(self, question: str, session_id: str, student_id: str) -> Dict[str, Any]:
        """
        执行完整工作流
        
        Args:
            question: 用户问题
            session_id: 会话ID
            student_id: 学生ID
            
        Returns:
            Dict: 包含 answer, sources, intent 等信息
        """
        # 创建工作流上下文
        context = WorkflowContext(
            question=question,
            session_id=session_id,
            student_id=student_id
        )
        
        try:
            # 步骤1: 意图识别
            context = await self._identify_intent(context)
            self.logger.info(f"[Workflow] 意图识别: {context.intent}")
            
            # 步骤2: 知识检索
            context = await self._retrieve_knowledge(context)
            self.logger.info(f"[Workflow] 检索到 {len(context.knowledge_sources)} 条相关知识")
            
            # 步骤3: Skill 匹配
            context = await self._match_skill(context)
            skill_name = context.selected_skill.name if context.selected_skill else "默认"
            self.logger.info(f"[Workflow] 选择 Skill: {skill_name}")
            
            # 步骤4: 生成回答
            context = await self._generate_answer(context)
            self.logger.info(f"[Workflow] 回答生成完成")
            
            # 步骤5: 清理动态Skill（如果使用了动态生成的Skill）
            if context.selected_skill and context.selected_skill.is_dynamic:
                self.logger.info(f"[Workflow] 清理动态Skill: {context.selected_skill.name}")
                self.skill_loader.delete_dynamic_skill(context.selected_skill)
            
            return {
                "answer": context.answer,
                "sources": context.knowledge_sources,
                "intent": context.intent.value if context.intent else None,
                "skill_used": skill_name,
                "session_id": session_id
            }
            
        except Exception as e:
            self.logger.error(f"[Workflow] 执行失败: {e}")
            import traceback
            traceback.print_exc()
            return {
                "answer": "抱歉，处理您的问题时遇到了一些问题，请稍后再试。",
                "sources": [],
                "intent": None,
                "skill_used": None,
                "session_id": session_id
            }
    
    async def _identify_intent(self, context: WorkflowContext) -> WorkflowContext:
        """
        步骤1: 意图识别
        
        使用规则 + AI 混合方式识别用户意图
        """
        question = context.question.lower()
        
        # 首先尝试规则匹配
        for intent, keywords in self.INTENT_KEYWORDS.items():
            for keyword in keywords:
                if re.search(keyword, question):
                    context.intent = intent
                    return context
        
        # 规则匹配失败，使用 AI 识别
        try:
            intent_prompt = f"""请分析以下问题的意图类型，只需返回一个类型名称：

问题：{context.question}

可选类型：
- concept_question（概念解释类：询问什么是XX、XX的定义、XX的原理等）
- code_analysis（代码分析类：涉及代码、程序、调试、实现等）
- problem_solving（问题解决类：具体的技术问题、如何做XX等）
- learning_advice（学习建议类：怎么学习、学习路径、资源推荐等）
- general_chat（一般对话：其他类型）

直接返回类型名称，不要其他内容。"""

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": intent_prompt}],
                temperature=0.1,
                max_tokens=50
            )
            
            intent_str = response.choices[0].message.content.strip().lower()
            
            # 映射到枚举
            intent_map = {
                "concept_question": IntentType.CONCEPT_QUESTION,
                "code_analysis": IntentType.CODE_ANALYSIS,
                "problem_solving": IntentType.PROBLEM_SOLVING,
                "learning_advice": IntentType.LEARNING_ADVICE,
                "general_chat": IntentType.GENERAL_CHAT,
            }
            
            context.intent = intent_map.get(intent_str, IntentType.GENERAL_CHAT)
            
        except Exception as e:
            self.logger.warning(f"AI 意图识别失败: {e}，使用默认意图")
            context.intent = IntentType.GENERAL_CHAT
        
        return context
    
    async def _retrieve_knowledge(self, context: WorkflowContext) -> WorkflowContext:
        """
        步骤2: 知识检索
        
        从向量数据库检索相关知识
        """
        try:
            if hasattr(self.vector_db, 'search_relevant_context'):
                search_results = self.vector_db.search_relevant_context(context.question)
                
                context_list = []
                for r in search_results:
                    content = r.get("content", r.get("page_content", ""))
                    metadata = r.get("metadata", {})
                    
                    # 获取来源名称，优先显示文件名
                    source_name = None
                    
                    # 优先级1: 直接的文件名
                    if metadata.get("filename"):
                        source_name = metadata["filename"]
                    # 优先级2: 文档名称
                    elif metadata.get("doc_name"):
                        source_name = metadata["doc_name"]
                    # 优先级3: 知识点名称（课件等）
                    elif metadata.get("knowledge_point_name"):
                        source_name = metadata["knowledge_point_name"]
                    # 优先级4: 标题
                    elif metadata.get("title"):
                        source_name = metadata["title"]
                    # 优先级5: collection名称转换
                    elif r.get("collection_name"):
                        coll_name = r.get("collection_name", "")
                        if coll_name.startswith("course_"):
                            source_name = f"课程资料_{coll_name.replace('course_', '')}"
                        else:
                            source_name = coll_name
                    # 最后: 默认值
                    else:
                        source_name = "知识库资料"
                    
                    # 添加块索引信息（如果有）
                    chunk_index = metadata.get("chunk_index")
                    total_chunks = metadata.get("total_chunks")
                    if chunk_index is not None and total_chunks and total_chunks > 1:
                        source_name += f" (第{chunk_index + 1}/{total_chunks}部分)"
                    
                    # 添加课程信息到元数据
                    enriched_metadata = {
                        **metadata,
                        "course_id": r.get("course_id"),
                        "source_name": source_name,
                        "similarity": r.get("similarity", 0)
                    }
                    
                    context_list.append(f"--- 来源: {source_name} ---\n{content}")
                    context.knowledge_sources.append(enriched_metadata)
                
                context.knowledge_context = "\n\n".join(context_list)
                self.logger.info(f"[Workflow] 检索到 {len(search_results)} 条知识，已添加来源信息")
                
        except Exception as e:
            self.logger.warning(f"知识检索失败: {e}")
            context.knowledge_context = ""
            context.knowledge_sources = []
        
        return context
    
    async def _match_skill(self, context: WorkflowContext) -> WorkflowContext:
        """
        步骤3: Skill 匹配（支持动态生成）
        
        根据意图选择合适的 Skill，如果没有匹配的则动态生成
        """
        # 1. 首先尝试智能匹配现有Skill
        skill = self.skill_loader.get_skill_for_intent(
            context.intent.value if context.intent else "general_chat",
            context.question
        )
        
        # 2. 如果智能匹配失败，尝试按意图映射获取
        if not skill:
            skill_name = self.INTENT_SKILL_MAP.get(context.intent, "智能问答专家")
            if skill_name:
                skill = self.skill_loader.get_skill_by_name(skill_name)
        
        # 3. 尝试默认的智能问答专家
        if not skill:
            skill = self.skill_loader.get_skill_by_name("智能问答专家")
        
        # 4. 尝试英文名
        if not skill:
            skill = self.skill_loader.get_skill_by_name("QA Expert")
        
        # 5. 如果还是没有匹配的Skill，或者是自定义任务，动态生成
        if not skill or context.intent == IntentType.CUSTOM_TASK:
            self.logger.info(f"[Workflow] 没有匹配的Skill，尝试动态生成...")
            skill = await self._generate_dynamic_skill(context)
        
        context.selected_skill = skill
        return context
    
    async def _generate_dynamic_skill(self, context: WorkflowContext) -> Skill:
        """
        动态生成Skill
        
        当用户的问题不匹配任何现有Skill时，使用AI分析问题并生成临时Skill
        """
        try:
            # 获取现有Skill列表供AI参考
            existing_skills = self.skill_loader.get_all_skills_summary()
            
            # 使用AI分析问题并生成Skill
            prompt = f"""你是一个专业的AI系统设计师。用户提出了一个问题，但现有的技能(Skill)都无法完美匹配。
请分析这个问题，并设计一个专门的技能来处理它。

【用户问题】
{context.question}

【现有技能列表】
{existing_skills}

【检索到的相关知识】
{context.knowledge_context[:1000] if context.knowledge_context else "无"}

请生成一个新的技能配置，以JSON格式返回：
{{
    "name": "技能名称（简短有意义）",
    "description": "技能描述（一句话说明用途）",
    "system_prompt": "详细的系统提示词，指导AI如何回答这类问题，包括：\n1. 角色定位\n2. 回答原则\n3. 输出格式要求"
}}

只返回JSON，不要其他内容。"""

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # 解析JSON
            # 尝试提取JSON部分
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                skill_config = json.loads(json_match.group())
            else:
                raise ValueError("无法解析AI返回的Skill配置")
            
            # 创建动态Skill
            skill = self.skill_loader.create_dynamic_skill(
                name=skill_config.get("name", "动态助手"),
                description=skill_config.get("description", "根据问题动态生成的助手"),
                content=skill_config.get("system_prompt", "你是一个专业的助手，请认真回答用户的问题。"),
                save_to_file=True  # 保存以便后续复用
            )
            
            self.logger.info(f"[Workflow] 动态Skill已生成: {skill.name}")
            return skill
            
        except Exception as e:
            self.logger.warning(f"[Workflow] 动态Skill生成失败: {e}，使用默认配置")
            
            # 生成失败时使用通用Skill（临时文件，用完即删）
            return self.skill_loader.create_dynamic_skill(
                name="通用问答助手",
                description="处理各类问题的通用助手",
                content="""你是一个专业的教学助手，能够回答各种问题。

## 回答原则
1. 准确：确保回答内容准确可靠
2. 清晰：用简洁易懂的语言解释
3. 实用：提供可操作的建议和示例
4. 友好：保持耐心和友好的态度

## 回答格式
1. 先给出直接答案
2. 然后详细解释
3. 如果适用，提供示例
4. 最后给出延伸建议""",
                save_to_file=True  # 保存为临时文件，执行完后会自动删除
            )
    
    async def _generate_answer(self, context: WorkflowContext) -> WorkflowContext:
        """
        步骤4: 生成回答
        
        使用选定的 Skill 和检索到的知识生成回答
        """
        # 判断是否有知识库内容
        has_knowledge = bool(context.knowledge_context and context.knowledge_context.strip())
        
        # 构建 System Prompt - 增强格式要求
        base_format_instructions = """
## 回答格式要求（非常重要，必须严格遵守）
你的回答必须层次分明、结构清晰，请严格按照以下格式：

1. **开头概述**：用1-2句话给出核心答案或定义，用**加粗**标注关键概念
2. **分点阐述**：使用数字编号（1. 2. 3.）分层次展开，每个要点要有小标题
3. **重点标注**：关键术语、重要概念用**加粗**标注
4. **举例说明**：适当使用具体例子帮助理解
5. **总结收尾**：如有必要，最后用"总结"或"综上所述"做简要总结

示例格式：
---
**核心概念**是指...（一句话定义）

下面从几个方面详细讲解：

**1. 第一个要点**
具体内容...

**2. 第二个要点**  
具体内容...

**总结**
简要总结...
---
"""
        
        if context.selected_skill:
            system_prompt = context.selected_skill.content + "\n" + base_format_instructions
        else:
            system_prompt = """你是一个专业的教学助手，能够基于提供的知识库内容回答学生的问题。
请用清晰、准确、易懂的语言回答，适当举例说明。""" + base_format_instructions
        
        # 构建 User Prompt
        if has_knowledge:
            knowledge_section = context.knowledge_context
            user_prompt = f"""请基于以下【参考知识】回答我的问题。请确保回答内容准确、层次分明、易于理解。

【参考知识】：
{knowledge_section}

【我的问题】：
{context.question}

请严格按照格式要求回答：
1. 先给出核心定义或直接答案（加粗关键词）
2. 分点详细展开（使用数字编号，每点有小标题）
3. 适当举例说明
4. 必要时给出总结"""
        else:
            # 没有知识库内容，使用通用知识回答
            user_prompt = f"""请基于你的专业知识回答以下问题。请确保回答内容准确、层次分明、易于理解。

【我的问题】：
{context.question}

请严格按照格式要求回答：
1. 先给出核心定义或直接答案（加粗关键词）
2. 分点详细展开（使用数字编号，每点有小标题）
3. 适当举例说明
4. 必要时给出总结"""
            
            # 标记为网络知识来源
            context.knowledge_sources = [{
                "source_name": "AI通用知识",
                "source_type": "web_knowledge",
                "content": "基于AI模型的通用知识回答"
            }]

        # 调用 AI 生成回答
        try:
            self.logger.info(f"[Workflow] 开始调用 AI 生成回答... (has_knowledge={has_knowledge})")
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                stream=False
            )
            
            context.answer = response.choices[0].message.content
            self.logger.info(f"[Workflow] AI 回答生成成功，长度: {len(context.answer)}")
        except Exception as e:
            self.logger.error(f"[Workflow] AI 调用失败: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        return context
    
    def get_available_skills(self) -> List[str]:
        """获取所有可用的 Skill 列表"""
        return self.skill_loader.get_skill_names()


# 全局实例
workflow_service = WorkflowService()
