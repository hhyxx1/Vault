"""问卷AI生成服务 - 集成DeepSeek API和技能注入"""

import json
import re
from typing import Dict, List, Optional, Any
from openai import OpenAI
from pathlib import Path
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.services.skill_loader import SkillLoader, Skill
from app.services.vector_db_service import VectorDBService
from app.models.survey import Survey, Question


class SurveyGenerationService:
    """问卷AI生成服务 - 参考chat-skills架构"""

    def __init__(self):
        """初始化服务"""
        # DeepSeek API配置
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        
        # 初始化OpenAI客户端（兼容DeepSeek）
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        # 加载技能
        self.skill_loader = SkillLoader()
        self.skill_loader.load_skills()
        
        # 向量数据库服务（用于知识库查询）
        self.vector_service = VectorDBService()

    def generate_survey_ai(
        self, 
        description: str,
        question_count: int = 10,
        include_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        AI生成问卷 - 纯AI深度思考，不调用知识库
        
        Args:
            description: 用户描述
            question_count: 题目数量
            include_types: 包含的题型 ["choice", "judge", "essay"]
            
        Returns:
            生成的问卷数据
        """
        print("=" * 70)
        print("🤖 AI生成模式 - 纯深度思考，不调用知识库")
        print(f"📝 描述: {description}")
        print(f"📊 题目数量: {question_count}")
        print(f"📋 题型要求: {include_types or '全部题型'}")
        print("=" * 70)
        
        # 获取AI生成技能
        skill = self.skill_loader.get_skill_by_name("AI问卷生成器")
        
        if not skill:
            raise ValueError("未找到AI问卷生成技能模板")
        
        # 构建用户提示
        user_prompt = self._build_ai_generation_prompt(
            description, 
            question_count, 
            include_types
        )
        
        print(f"💬 用户提示:\n{user_prompt}\n")
        
        # 注入技能并调用AI
        response_text = self._call_llm_with_skill(skill, user_prompt)
        
        # 解析JSON响应
        survey_data = self._parse_json_response(response_text)
        
        # 验证题型是否符合要求
        if include_types:
            self._validate_question_types(survey_data, include_types)
        
        print(f"✅ 成功生成 {len(survey_data.get('questions', []))} 道题目")
        print("=" * 70)
        
        return survey_data

    def generate_survey_knowledge_based(
        self,
        description: str,
        course_id: Optional[str] = None,
        question_count: int = 10,
        include_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        基于知识库生成问卷（优先检索模式）
        
        生成策略：
        1. 必须先检索知识库（如果指定了course_id则检索该课程，否则检索所有知识库）
        2. 如果检索到相关内容，优先基于知识库生成
        3. 只有在知识库没有相关内容时，才基于AI深度思考生成
        
        Args:
            description: 用户描述
            course_id: 课程ID（UUID字符串，可选，不传则在所有知识库中检索）
            question_count: 题目数量
            include_types: 包含的题型
            
        Returns:
            生成的问卷数据
        """
        print("=" * 70)
        print("📚 知识库生成模式 - 优先检索知识库")
        print(f"📝 描述: {description}")
        print(f"📊 题目数量: {question_count}")
        print(f"📋 题型要求: {include_types or '全部题型'}")
        print(f"📚 课程ID: {course_id if course_id else '所有课程（全局检索）'}")
        print("=" * 70)
        
        # 1. 必须先检索知识库
        print("🔍 步骤1: 开始检索知识库...")
        knowledge_context, has_knowledge = self._retrieve_knowledge_smart(description, course_id)
        
        if has_knowledge:
            print(f"✅ 检索成功！找到相关知识，优先基于知识库生成")
        else:
            print(f"⚠️  知识库中未找到相关内容，将基于AI深度思考生成")
        
        # 2. 获取知识库生成技能
        skill = self.skill_loader.get_skill_by_name("基于知识库的问卷生成器")
        
        if not skill:
            raise ValueError("未找到知识库问卷生成技能模板")
        
        # 3. 构建提示（根据是否有知识采用不同策略）
        user_prompt = self._build_kb_generation_prompt_smart(
            description,
            knowledge_context,
            question_count,
            include_types,
            has_knowledge
        )
        
        print(f"\n💬 生成策略: {'[知识库优先]' if has_knowledge else '[AI深度思考]'}\n")
        
        # 4. 注入技能并调用AI
        response_text = self._call_llm_with_skill(skill, user_prompt)
        
        # 5. 解析JSON响应
        survey_data = self._parse_json_response(response_text)
        
        # 6. 验证题型是否符合要求
        if include_types:
            self._validate_question_types(survey_data, include_types)
        
        print(f"✅ 成功生成 {len(survey_data.get('questions', []))} 道题目")
        print(f"📚 生成模式: {'[知识库优先]' if has_knowledge else '[AI深度思考]'}")
        print("=" * 70)
        
        return survey_data

    def _retrieve_knowledge_smart(
        self, 
        query: str, 
        course_id: Optional[str] = None, 
        top_k: int = 8
    ) -> tuple[str, bool]:
        """
        智能检索知识库
        
        Args:
            query: 查询文本
            course_id: 课程ID（UUID字符串，可选，不传则检索所有知识库）
            top_k: 返回结果数量
            
        Returns:
            (knowledge_context, has_knowledge): 知识内容和是否有知识
        """
        try:
            print(f"   ➡️ 检索查询: {query[:50]}...")
            print(f"   ➡️ 课程ID: {course_id if course_id else '所有课程（全局检索）'}")
            print(f"   ➡️ 检索数量: top_{top_k}")
            
            # 使用向量数据库服务查询
            # course_id已经是UUID字符串或None
            results = self.vector_service.search_similar(
                query=query,
                course_id=course_id,
                n_results=top_k
            )
            
            if not results:
                print(f"   ❌ 未找到任何相关知识")
                return "知识库中未找到相关内容。", False
            
            print(f"   ✅ 检索到 {len(results)} 条相关知识")
            
            # 格式化检索结果
            knowledge_parts = []
            knowledge_parts.append(f"检索到 {len(results)} 条相关知识：\n")
            
            for idx, result in enumerate(results, 1):
                content = result.get('content', '')
                metadata = result.get('metadata', {}) or {}  # 确保metadata不是None
                similarity = result.get('similarity', 0)
                
                # 获取来源信息，处理各种可能的键名
                source = (
                    metadata.get('source') or 
                    metadata.get('filename') or 
                    metadata.get('file_name') or 
                    metadata.get('document_name') or 
                    '未知来源'
                )
                
                knowledge_parts.append(f"[知识片段{idx}]")
                knowledge_parts.append(f"相关度: {similarity:.1%}")
                knowledge_parts.append(f"来源: {source}")
                knowledge_parts.append(f"内容: {content[:300]}...")  # 增加长度从200到300
                knowledge_parts.append("")
                
                # 打印到控制台
                print(f"   📚 片段{idx}: {source} (相关度: {similarity:.1%})")
            
            return "\n".join(knowledge_parts), True
            
        except Exception as e:
            print(f"   ❌ 知识检索错误: {e}")
            import traceback
            traceback.print_exc()
            return f"知识库检索遇到问题，将基于主题深度思考出题。", False

    def _build_ai_generation_prompt(
        self,
        description: str,
        question_count: int,
        include_types: Optional[List[str]]
    ) -> str:
        """构建AI生成的用户提示"""
        prompt_parts = [
            f"请根据以下描述生成一份问卷：",
            f"",
            f"描述: {description}",
            f"题目数量: {question_count}题",
        ]
        
        if include_types:
            types_map = {
                "choice": "选择题",
                "judge": "判断题",
                "essay": "问答题"
            }
            types_str = "、".join([types_map.get(t, t) for t in include_types])
            prompt_parts.append(f"题型要求: 【严格限制】只能生成{types_str}，不能生成其他题型")
            prompt_parts.append(f"⚠️ 重要：必须严格遵守题型限制，生成的{question_count}道题目必须全部是指定的题型")
        else:
            prompt_parts.append(f"题型要求: 选择题、判断题、问答题合理分布")
        
        prompt_parts.extend([
            f"",
            f"要求：",
            f"1. 严格按照技能模板中的JSON格式输出",
            f"2. 确保所有答案准确无误",
            f"3. 每题必须有详细解析",
            f"4. 分数分配合理，总分接近100分",
            f"5. 只输出JSON，不要有任何其他文字",
        ])
        
        return "\n".join(prompt_parts)

    def _build_kb_generation_prompt_smart(
        self,
        description: str,
        knowledge_context: str,
        question_count: int,
        include_types: Optional[List[str]],
        has_knowledge: bool
    ) -> str:
        """构建基于知识库生成的用户提示（智能模式）"""
        prompt_parts = [
            f"请基于知识库内容和深度思考生成问卷：",
            f"",
            f"用户需求: {description}",
            f"题目数量: {question_count}题",
        ]
        
        if include_types:
            types_map = {
                "choice": "选择题",
                "judge": "判断题",
                "essay": "问答题"
            }
            types_str = "、".join([types_map.get(t, t) for t in include_types])
            prompt_parts.append(f"题型要求: 【严格限制】只能生成{types_str}，不能生成其他题型")
            prompt_parts.append(f"⚠️ 重要：必须严格遵守题型限制，生成的{question_count}道题目必须全部是指定的题型")
        else:
            prompt_parts.append(f"题型要求: 选择题、判断题、问答题合理分布")
        
        prompt_parts.extend([
            f"",
            f"=" * 60,
            f"知识库检索内容：",
            f"=" * 60,
            knowledge_context,
            f"=" * 60,
            f"",
        ])
        
        if has_knowledge:
            # 有知识库内容：优先使用知识库
            prompt_parts.extend([
                f"📚 生成策略（知识库优先模式）：",
                f"",
                f"1. **基于知识库生成**：",
                f"   - 仔细阅读上述检索到的知识内容",
                f"   - 优先从知识库中提取题目和答案",
                f"   - 每题必须标注knowledge_source字段",
                f"   - 确保题目与知识库内容直接相关",
                f"",
                f"2. **质量保证**：",
                f"   - 所有答案必须准确无误",
                f"   - 有知识库支撑的题目，标注具体来源",
                f"   - 解析必须引用知识库中的相关内容",
                f"",
                f"3. **标注规范**：",
                f"   - 直接来自知识库：\"文档名 - 具体章节\"",
                f"   - 例如：knowledge_source: \"操作系统教程 - 第3章进程管理\"",
            ])
        else:
            # 没有知识库内容：基于AI深度思考
            prompt_parts.extend([
                f"🧠 生成策略（AI深度思考模式）：",
                f"",
                f"⚠️ **注意**：知识库中未找到相关内容，请基于主题深度思考生成题目。",
                f"",
                f"1. **深度思考生成**：",
                f"   - 基于用户需求中的主题和关键词",
                f"   - 调用你的知识和逻辑推理能力",
                f"   - 生成高质量、符合主题的题目",
                f"",
                f"2. **质量保证**：",
                f"   - 确保答案100%准确",
                f"   - 提供详细的解析和推理过程",
                f"   - 题目难度合适，符合教学要求",
                f"",
                f"3. **标注规范**：",
                f"   - knowledge_source: \"AI深度思考 - [主题]\"",
                f"   - 例如：knowledge_source: \"AI深度思考 - 操作系统进程管理\"",
            ])
        
        prompt_parts.extend([
            f"",
            f"=" * 60,
            f"📋 输出要求：",
            f"",
            f"1. 严格按照技能模板中的JSON格式输出",
            f"2. 确保所有答案准确无误",
            f"3. 每题必须有详细解析（≥50字符）",
            f"4. 分数分配合理，总分接近100分",
            f"5. 每题必须标注knowledge_source",
            f"6. 只输出JSON，不要有任何其他文字",
        ])
        
        return "\n".join(prompt_parts)

    def _call_llm_with_skill(self, skill: Skill, user_prompt: str) -> str:
        """
        调用LLM并注入技能 - 参考chat-skills的注入方式
        
        Args:
            skill: 技能对象
            user_prompt: 用户提示
            
        Returns:
            AI响应文本
        """
        # 构建系统提示（注入技能）
        system_prompt = self._build_system_prompt_with_skill(skill)
        
        # 调用OpenAI兼容API
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"调用DeepSeek API失败: {str(e)}")

    def _build_system_prompt_with_skill(self, skill: Skill) -> str:
        """
        构建包含技能注入的系统提示 - 参考chat-skills
        
        Args:
            skill: 技能对象
            
        Returns:
            完整的系统提示
        """
        base_prompt = """你是一个专业的问卷生成助手。你的任务是根据用户需求生成高质量的问卷。

当技能指导被提供时：
- 严格遵循技能中定义的格式和规范
- 确保输出内容的准确性和专业性
- 只输出要求的JSON格式，不要包含其他内容
- 所有答案必须准确，解析必须详细
"""
        
        # 注入技能内容
        parts = [
            base_prompt,
            "\n" + "=" * 60,
            "技能指导内容（必须遵循）",
            "=" * 60,
            f"\n技能名称: {skill.name}\n",
            skill.content,
            "\n" + "=" * 60,
            "技能指导内容结束",
            "=" * 60,
            "\n重要提醒：",
            "- 严格按照上述技能模板生成内容",
            "- 只输出JSON格式，不要有markdown代码块标记",
            "- 确保JSON格式正确可解析",
            "- 所有必需字段都要填写完整"
        ]
        
        return "\n".join(parts)

    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """
        解析AI返回的JSON响应 - 处理各种格式
        
        Args:
            response_text: AI响应文本
            
        Returns:
            解析后的字典
        """
        # 清理响应文本
        cleaned_text = response_text.strip()
        
        # 移除markdown代码块标记
        if cleaned_text.startswith("```"):
            lines = cleaned_text.split("\n")
            # 移除开头的```json或```
            if lines[0].startswith("```"):
                lines = lines[1:]
            # 移除结尾的```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned_text = "\n".join(lines).strip()
        
        # 尝试解析JSON
        try:
            data = json.loads(cleaned_text)
        except json.JSONDecodeError as e:
            # 尝试查找JSON部分
            json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                except:
                    raise ValueError(f"无法解析AI返回的JSON: {str(e)}\n原始响应: {response_text[:500]}")
            else:
                raise ValueError(f"响应中未找到有效的JSON: {response_text[:500]}")
        
        # 验证必需字段
        required_fields = ["survey_title", "description", "questions"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"生成的问卷缺少必需字段: {field}")
        
        # 验证题目格式
        if not isinstance(data["questions"], list) or len(data["questions"]) == 0:
            raise ValueError("生成的问卷没有题目")
        
        return data

    def validate_survey_data(self, survey_data: Dict[str, Any]) -> bool:
        """
        验证问卷数据格式
        
        Args:
            survey_data: 问卷数据
            
        Returns:
            是否有效
        """
        try:
            # 检查基本字段
            if not all(key in survey_data for key in ["survey_title", "description", "questions"]):
                return False
            
            # 检查每道题
            for question in survey_data["questions"]:
                required = ["question_type", "question_text", "correct_answer", "score", "explanation"]
                if not all(key in question for key in required):
                    return False
                
                # 检查题型
                if question["question_type"] not in ["choice", "judge", "essay"]:
                    return False
                
                # 选择题和判断题需要options
                if question["question_type"] in ["choice", "judge"]:
                    if "options" not in question or not question["options"]:
                        return False
            
            return True
            
        except Exception:
            return False

    def _validate_question_types(
        self, 
        survey_data: Dict[str, Any], 
        expected_types: List[str]
    ) -> None:
        """
        验证生成的题目是否符合题型要求
        
        Args:
            survey_data: 问卷数据
            expected_types: 期望的题型列表
            
        Raises:
            ValueError: 如果题型不符合要求
        """
        questions = survey_data.get('questions', [])
        
        for idx, question in enumerate(questions, 1):
            q_type = question.get('question_type')
            
            if q_type not in expected_types:
                # 题型不符合要求
                types_map = {
                    "choice": "选择题",
                    "judge": "判断题",
                    "essay": "问答题"
                }
                expected_str = "、".join([types_map.get(t, t) for t in expected_types])
                actual_str = types_map.get(q_type, q_type)
                
                error_msg = (
                    f"❌ 题型验证失败！\n"
                    f"   第{idx}题是{actual_str}，但只允许生成：{expected_str}\n"
                    f"   题目：{question.get('question_text', '')[:50]}...\n"
                    f"   请确保所有题目都是指定的题型。"
                )
                print(error_msg)
                raise ValueError(error_msg)
        
        print(f"✅ 题型验证通过：所有 {len(questions)} 道题目都符合要求")

    def save_to_database(
        self,
        survey_data: Dict[str, Any],
        teacher_id: str,
        course_id: Optional[str],
        generation_method: str,
        generation_prompt: str,
        db: Session
    ) -> Survey:
        """
        将生成的问卷保存到数据库
        
        Args:
            survey_data: 生成的问卷数据
            teacher_id: 教师ID
            course_id: 课程ID（可选）
            generation_method: 生成方式 ('ai' 或 'knowledge_based')
            generation_prompt: 生成提示词
            db: 数据库会话
            
        Returns:
            创建的Survey对象
        """
        try:
            # 创建问卷记录
            survey = Survey(
                title=survey_data["survey_title"],
                description=survey_data.get("description", ""),
                teacher_id=uuid.UUID(teacher_id),
                course_id=uuid.UUID(course_id) if course_id else None,
                survey_type='exam',  # AI生成的默认为考试类型
                generation_method=generation_method,
                generation_prompt=generation_prompt,
                status='draft',  # 初始状态为草稿
                total_score=self._calculate_total_score(survey_data["questions"]),
                pass_score=60,
                allow_multiple_attempts=False,
                max_attempts=1,
                show_answer=True,  # AI生成的默认显示答案
                shuffle_questions=False
            )
            
            db.add(survey)
            db.flush()  # 获取survey_id
            
            # 创建题目记录
            for idx, q_data in enumerate(survey_data["questions"], start=1):
                question = Question(
                    survey_id=survey.id,
                    question_type=q_data["question_type"],
                    question_text=q_data["question_text"],
                    question_order=idx,
                    score=float(q_data["score"]),
                    difficulty='medium',  # 默认中等难度
                    options=q_data.get("options", []),
                    correct_answer=q_data["correct_answer"],
                    answer_explanation=q_data.get("explanation", ""),
                    tags=[],
                    knowledge_points=self._extract_knowledge_points(q_data),
                    is_required=True
                )
                db.add(question)
            
            db.commit()
            db.refresh(survey)
            
            return survey
            
        except Exception as e:
            db.rollback()
            raise Exception(f"保存问卷到数据库失败: {str(e)}")

    def _calculate_total_score(self, questions: List[Dict]) -> int:
        """计算问卷总分"""
        total = sum(float(q.get("score", 0)) for q in questions)
        return int(total)

    def _extract_knowledge_points(self, question_data: Dict) -> List[str]:
        """从题目数据中提取知识点"""
        knowledge_points = []
        
        # 如果有knowledge_source字段（知识库生成）
        if "knowledge_source" in question_data:
            knowledge_points.append(question_data["knowledge_source"])
        
        return knowledge_points
