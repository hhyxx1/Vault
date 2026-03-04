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
from app.models.survey import Survey, Question


class SurveyGenerationService:
    """问卷AI生成服务 - 参考chat-skills架构。向量库仅在「基于知识库」生成时按需加载。"""

    def __init__(self):
        """初始化服务（不初始化向量库，避免 AI 生成时加载）"""
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
        
        # 向量数据库延迟初始化，仅「基于知识库」生成时使用
        self._vector_service = None

    def _get_vector_service(self):
        """按需获取向量数据库服务（仅知识库生成路径会调用）"""
        if self._vector_service is None:
            from app.services.vector_db_service import VectorDBService
            self._vector_service = VectorDBService()
        return self._vector_service

    def generate_survey_ai(
        self,
        description: str,
        question_count: Optional[int] = None,
        include_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        AI生成问卷 - 纯AI深度思考，不调用知识库；使用 skill 根据描述生成。
        题型与数量：若调用方未传 question_count/include_types，则完全由描述解析，
        描述未写则按 skill 默认（20题、三种题型）。
        """
        print("=" * 70)
        print("🤖 AI生成模式 - 纯深度思考，不调用知识库，依据描述生成")
        print(f"📝 描述: {description}")
        if question_count is not None:
            print(f"📊 题目数量(显式): {question_count}")
        else:
            print("📊 题目数量: 由描述解析，未写默认20题")
        if include_types is not None:
            print(f"📋 题型要求(显式): {include_types}")
        else:
            print("📋 题型要求: 由描述解析，未写默认三种题型")
        print("=" * 70)
        
        skill = self.skill_loader.get_skill_by_name("AI问卷生成器")
        if not skill:
            raise ValueError("未找到AI问卷生成技能模板")
        
        user_prompt = self._build_ai_generation_prompt(description, question_count, include_types)
        print(f"💬 用户提示:\n{user_prompt}\n")
        
        response_text = self._call_llm_with_skill(skill, user_prompt)
        survey_data = self._parse_json_response(response_text)
        
        if include_types is not None:
            self._validate_question_types(survey_data, include_types)
        
        print(f"✅ 成功生成 {len(survey_data.get('questions', []))} 道题目")
        print("=" * 70)
        return survey_data

    def generate_survey_knowledge_based(
        self,
        description: str,
        course_id: Optional[str] = None,
        knowledge_source_type: str = "material",
        document_id: Optional[str] = None,
        question_count: int = 20,
        include_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        基于知识库生成问卷（优先检索模式）
        
        生成策略：
        1. 课程可选：不选则在所有知识库中根据描述解析并检索；选则仅在该课程知识库中检索
        2. 检索必须完整：尽量检索到所有相关片段，不遗漏
        3. knowledge_source_type: outline=优先依据大纲知识点/知识图谱, material=优先依据上传资料
        4. 题目禁止带「基于xx生成」前缀；描述未说明时默认 20 道、三种题型
        
        Args:
            description: 用户描述
            course_id: 课程ID（可选；不选则全局检索所有知识库）
            knowledge_source_type: outline | material
            question_count: 题目数量（默认20）
            include_types: 包含的题型
            
        Returns:
            生成的问卷数据
        """
        print("=" * 70)
        print("📚 知识库生成模式 - 检索知识库并基于 skill 生成")
        print(f"📝 描述: {description}")
        print(f"📊 题目数量: {question_count}")
        print(f"📋 题型要求: {include_types or '全部题型'}")
        print(f"📚 课程: {course_id if course_id else '不指定（在所有知识库中检索）'}")
        print(f"📂 来源类型: {knowledge_source_type}（outline=大纲知识图谱, material=上传资料）")
        if knowledge_source_type == "material" and document_id:
            print(f"📄 指定资料: {document_id}")
        print("=" * 70)
        
        # 1. 检索知识库（不选课程=全局检索；选课程=该课程检索；可指定单篇资料）
        print("🔍 步骤1: 检索知识库（尽量覆盖所有相关内容）...")
        knowledge_context, has_knowledge = self._retrieve_knowledge_smart(
            description, course_id, knowledge_source_type=knowledge_source_type, document_id=document_id
        )
        
        if has_knowledge:
            print(f"✅ 检索成功！找到相关知识，优先基于知识库生成")
        else:
            print(f"⚠️  知识库中未找到相关内容，将基于AI深度思考生成")
        
        # 2. 获取知识库生成技能
        skill = self.skill_loader.get_skill_by_name("基于知识库的问卷生成器")
        
        if not skill:
            raise ValueError("未找到知识库问卷生成技能模板")
        
        # 3. 构建提示（根据是否有知识、来源类型采用不同策略）
        user_prompt = self._build_kb_generation_prompt_smart(
            description,
            knowledge_context,
            question_count,
            include_types,
            has_knowledge,
            knowledge_source_type=knowledge_source_type,
            document_id=document_id
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
        top_k: int = 20,
        knowledge_source_type: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> tuple[str, bool]:
        """
        检索知识库，不设数量限制，检索完所有相关内容、不遗漏。
        - course_id 为空：在所有课程知识库中检索，每课程取全部文档，汇总后全部返回。
        - course_id 指定：仅在该课程知识库中检索，取该课程内全部文档。
        - document_id 指定（仅 material 时有效）：仅从该篇资料的片段中检索。
        - 结果少时做扩展查询合并去重。
        """
        try:
            vec = self._get_vector_service()
            print(f"   ➡️ 检索查询: {query[:80]}...")
            filter_metadata = None
            if document_id and course_id:
                filter_metadata = {"document_id": document_id}
                print(f"   ➡️ 仅检索指定资料: {document_id[:8]}…")
            elif knowledge_source_type == "material" and course_id:
                # 基于资料：只检索资料类文档，排除大纲
                filter_metadata = {"document_type": "material"}
                print(f"   ➡️ 仅检索该课程下资料（排除大纲）")
            elif knowledge_source_type == "outline" and course_id:
                # 基于大纲：只检索大纲类文档，排除资料
                filter_metadata = {"document_type": "outline"}
                print(f"   ➡️ 仅检索该课程下大纲（排除资料）")
            
            if course_id:
                # 指定课程：取该课程知识库内全部文档（或按 document_id 过滤），无数量上限
                total = vec.get_stats(course_id=course_id).get("total_documents", 0)
                n_results = total if total else 1
                print(f"   ➡️ 课程ID: {course_id}，检索数量: 全部 {n_results} 条（无上限）")
                
                results = vec.search_similar(
                    query=query,
                    course_id=course_id,
                    n_results=n_results,
                    filter_metadata=filter_metadata
                )
                
                # 结果较少时用关键词扩展再查一轮
                if len(results) < 8 and len(query.strip()) > 4:
                    parts = query.replace("，", " ").replace("、", " ").split()
                    if len(parts) > 2:
                        extra_query = " ".join(parts[:6])
                        extra = vec.search_similar(
                            query=extra_query,
                            course_id=course_id,
                            n_results=n_results,
                            filter_metadata=filter_metadata
                        )
                        seen_ids = {r.get("id") for r in results}
                        for r in extra:
                            if r.get("id") not in seen_ids:
                                results.append(r)
                                seen_ids.add(r.get("id"))
                        if len(extra) > 0:
                            print(f"   ➡️ 扩展检索后共 {len(results)} 条")
            else:
                # 不选课程：在所有知识库中检索；按来源类型只检索大纲或只检索资料，不混合
                global_filter = None
                if knowledge_source_type == "material":
                    global_filter = {"document_type": "material"}
                    print(f"   ➡️ 在所有知识库中检索（仅资料，排除大纲）")
                elif knowledge_source_type == "outline":
                    global_filter = {"document_type": "outline"}
                    print(f"   ➡️ 在所有知识库中检索（仅大纲，排除资料）")
                else:
                    print(f"   ➡️ 在所有知识库中检索（每课程取全部文档，汇总后全部返回，无数量限制）")
                
                results = vec.search_all_courses(
                    query=query,
                    n_results=0,  # 未使用，每课程内部已取全部
                    course_ids=None,
                    filter_metadata=global_filter
                )
                
                # 结果较少时扩展查询
                if len(results) < 8 and len(query.strip()) > 4:
                    parts = query.replace("，", " ").replace("、", " ").split()
                    if len(parts) > 2:
                        extra_query = " ".join(parts[:6])
                        extra = vec.search_all_courses(
                            query=extra_query,
                            n_results=0,
                            course_ids=None,
                            filter_metadata=global_filter
                        )
                        seen_ids = {r.get("id") for r in results}
                        for r in extra:
                            if r.get("id") not in seen_ids:
                                results.append(r)
                                seen_ids.add(r.get("id"))
                        if len(extra) > 0:
                            print(f"   ➡️ 扩展检索后共 {len(results)} 条")
            
            if not results:
                print(f"   ❌ 未找到任何相关知识")
                return "知识库中未找到相关内容。", False
            
            print(f"   ✅ 检索到 {len(results)} 条相关知识（已尽量覆盖，避免遗漏）")
            
            # 统一格式化（兼容 search_similar 与 search_all_courses 的返回）
            knowledge_parts = []
            knowledge_parts.append(f"检索到 {len(results)} 条相关知识：\n")
            
            for idx, result in enumerate(results, 1):
                content = result.get('content', '')
                metadata = result.get('metadata', {}) or {}
                if isinstance(metadata, dict):
                    pass
                else:
                    metadata = {}
                similarity = result.get('similarity', 0)
                
                source = (
                    metadata.get('source') or 
                    metadata.get('filename') or 
                    metadata.get('file_name') or 
                    metadata.get('document_name') or 
                    '未知来源'
                )
                course_label = result.get('course_id', '')
                if course_label:
                    source = f"{source}（课程: {course_label[:8]}…）" if len(str(course_label)) > 8 else f"{source}（课程: {course_label}）"
                
                knowledge_parts.append(f"[知识片段{idx}]")
                knowledge_parts.append(f"相关度: {similarity:.1%}" if isinstance(similarity, (int, float)) else f"相关度: —")
                knowledge_parts.append(f"来源: {source}")
                knowledge_parts.append(f"内容: {content[:400]}...")
                knowledge_parts.append("")
                
                print(f"   📚 片段{idx}: {source} (相关度: {similarity:.1%})" if isinstance(similarity, (int, float)) else f"   📚 片段{idx}: {source}")
            
            return "\n".join(knowledge_parts), True
            
        except Exception as e:
            print(f"   ❌ 知识检索错误: {e}")
            import traceback
            traceback.print_exc()
            return "知识库检索遇到问题，将基于主题深度思考出题。", False

    def _build_ai_generation_prompt(
        self,
        description: str,
        question_count: Optional[int] = None,
        include_types: Optional[List[str]] = None
    ) -> str:
        """构建AI生成的用户提示。未传题目数量/题型时仅给描述，由 skill 规定：描述未写则默认20题、三种题型。"""
        prompt_parts = [
            "请根据以下描述生成一份问卷：",
            "",
            f"描述: {description}",
        ]
        if question_count is not None:
            prompt_parts.append(f"题目数量: {question_count}题（若描述中已写数量，以描述为准）")
        else:
            prompt_parts.append("题目数量与题型: 请从描述中解析；若描述中未明确写题目数量则默认20道，未明确写题型则默认包含选择题、判断题、问答题三种。")
            prompt_parts.append("【重要】若描述中未指定题目数量，你必须生成恰好20道题目，不能少于20道也不能多于20道。")
        if include_types:
            types_map = {"choice": "选择题", "judge": "判断题", "essay": "问答题"}
            types_str = "、".join([types_map.get(t, t) for t in include_types])
            prompt_parts.append(f"题型要求: 【严格限制】只能生成{types_str}，不能生成其他题型")
            if question_count is not None:
                prompt_parts.append(f"⚠️ 重要：必须严格遵守题型限制，生成的{question_count}道题目必须全部是指定的题型")
        elif question_count is None:
            prompt_parts.append("题型要求: 从描述中解析；若描述未指定题型，则选择题、判断题、问答题合理分布。")
        else:
            prompt_parts.append("题型要求: 选择题、判断题、问答题合理分布")
        prompt_parts.extend([
            "",
            "【必须严格遵守的格式要求】：",
            "1. 严格按照技能模板中的JSON格式输出",
            "2. 选择题(choice)的 options 只写选项内容，不要加 \"A.\"、\"B.\"、\"C.\"、\"D.\"，例如: [\"内容1\", \"内容2\", \"内容3\", \"内容4\"]",
            "3. 判断题(judge)的 options 为 [\"正确\", \"错误\"]",
            "4. 问答题(essay)的options必须是空数组: []",
            "5. 确保所有答案准确无误",
            "6. 每题必须有解析（30–50字，简明扼要，减少冗余）",
            "7. 分数分配合理，总分接近100分",
            "8. 只输出JSON，不要有任何其他文字或markdown标记",
            "",
            "⚠️ 特别注意：选择题和判断题的options字段是必填项，绝对不能为空！",
        ])
        return "\n".join(prompt_parts)

    def _build_kb_generation_prompt_smart(
        self,
        description: str,
        knowledge_context: str,
        question_count: int,
        include_types: Optional[List[str]],
        has_knowledge: bool,
        knowledge_source_type: str = "material",
        document_id: Optional[str] = None
    ) -> str:
        """构建基于知识库生成的用户提示（智能模式）"""
        import time
        prompt_parts = [
            f"请基于知识库内容和深度思考生成问卷：",
            f"",
            f"用户需求: {description}",
            f"题目数量: {question_count}题（描述未说明时默认20道）",
            f"【题目唯一性】每次生成题目必须不同：变换问法、考查角度或表述，不要与常见题或以往生成雷同。本次生成标识: {int(time.time())}，请在问法、选项顺序或考查侧重点上做适当变化，确保题目新颖。",
            f"",
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
            prompt_parts.append(f"题型要求: 选择题、判断题、问答题合理分布（描述未说明时默认三种题型）")
        
        # 题目表述禁止带「基于xx生成」前缀
        prompt_parts.extend([
            f"",
            f"【题目表述】每道题的 question_text 必须是题目本身，禁止在题目前加「基于xx生成」等前缀，直接写题目内容。",
            f"",
        ])
        
        # 来源类型说明
        if knowledge_source_type == "outline":
            prompt_parts.append(f"📂 用户选择「基于大纲中的知识点/知识图谱」：请依据课程大纲中的知识点与知识图谱结构出题。")
            prompt_parts.append(f"   **覆盖要求（必须满足）**：检索到的每一章、每个实验、每个实训项目等**至少对应一题**，确保整套题**覆盖全部**检索到的知识点、无遗漏；这样教师才能依据答题情况判断学生对整门课的掌握程度。不得把多道题集中在少数章节。")
            prompt_parts.append(f"   **文字规范**：题目、选项、解析均不得出现错别字，用字用词须准确规范。")
        else:
            prompt_parts.append(f"📂 用户选择「基于上传的资料」：请**从检索到的内容中筛选重要知识点**，再严格按知识点出题。")
            if document_id:
                prompt_parts.append(f"   **范围**：用户指定了单篇资料，请仅根据该资料中的知识点出题。")
            else:
                prompt_parts.append(f"   **范围**：未指定具体资料，检索结果为该课程下多篇资料；请从中**选择重要、核心的知识点**生成测试题，确保题目覆盖多个重要知识点而非集中在某一处。")
        prompt_parts.append("")
        
        prompt_parts.extend([
            f"=" * 60,
            f"知识库检索内容：",
            f"=" * 60,
            knowledge_context,
            f"=" * 60,
            f"",
        ])
        
        if has_knowledge:
            prompt_parts.extend([
                f"📚 生成策略（只出知识点题，完完全全基于知识点）：",
                f"",
                f"1. **“知识点”仅指**：概念、定义、原理、技术名称、操作技能、章节中的技术/理论要点（如：进程、Vibe Coding、分布式协同、某实验的技术目标与步骤）。",
                f"   - 每道题必须**直接考查**上述某一具体知识点，题干直接问该知识点，例如：「X是什么？」「下列哪项属于X？」。",
                f"   - 检索到某知识点（如「进程」）则围绕该知识点出题（如「进程是什么？」「进程的三种基本状态是什么？」），不要围绕课程规定、考核、思政出题。",
                f"",
                f"2. **禁止出题的内容（一律忽略，不得据此出题）**：",
                f"   - 课程基本信息：总学时、学分、先修、课程代码、任课教师、开课学期；",
                f"   - 思政融入点、课程思政、育人目标；",
                f"   - 考核说明、考核方式、考核原则、成绩评定、提审上线规定、伪造处理；",
                f"   - 课程要求、学生行为规范、能否过度依赖AI、独立完成要求等非技术性规定。",
                f"   - 禁止题目出现：「根据课程内容」「课程中，学生可以…吗」「本课程」「本课程中」「本课程考核…」等表述；题干直接写对知识点的提问。",
                f"   - 题干**禁止**出现：本课程、本课程中、目标要求、学生需要掌握、学生需要掌握哪些核心技能、核心技能要求、课程目标 等字样；只写对知识点本身的提问（如「Flutter 主要用于开发鸿蒙应用的哪一层？」而非「本课程中 Flutter 主要用于…」）。",
                f"   - **禁止**以「…实验/实训的目标要求」「…的目标是什么」「简述…实验的目标要求」等形式出题；若考查某实验或实训，须问其**技术内容**，例如：「分布式协同与跨端通信实验主要涉及哪些技术能力？」「简述实现分布式协同与跨端通信需掌握的技术要点。」而非「简述分布式协同与跨端通信实验的目标要求。」",
                f"   - **禁止**题干出现「学生」及以学生/教学为视角的表述：如 学生、要求学生、让学生、考核学生、训练哪项技能、考核…能力、实训/实验的目标、目标之一、旨在… 等；只问知识点或技术本身（如「组件开发与跨端适配实践主要涉及哪些技术？」而非「主要训练哪项技能？」「考核学生哪些能力？」）。",
                f"",
                f"3. **质量与标注**：",
                f"   - 题目正文（question_text）只写对知识点的提问，不要「基于xx生成」「根据课程内容」「本课程」「目标要求」「…的目标是什么」等前缀或课程元表述。",
                f"   - 每题 knowledge_source 须为具体知识点/章节（不能是考核说明、思政、课程基本信息）。",
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
            f"📋 输出要求（必须严格遵守）：",
            f"",
            f"1. 只出知识点题：严禁根据课程基本信息、思政、考核说明、课程要求/学生规范出题；只根据具体知识点（概念、定义、原理、技术、技能）出题，题干直接问该知识点（如「X是什么？」）。每道题必须能明确对应某一具体知识点，不得出「…实验/实训的目标要求」「…的目标是什么」等元问题。",
            f"2. 题干禁止出现：本课程、本课程中、学生、要求学生、考核学生、训练哪项技能、考核…能力、目标要求、…实验/实训的目标、目标之一、旨在…、学生需要掌握、核心技能要求 等字样；只问知识点或技术内容（如「…实验主要涉及哪些技术？」「组件开发与跨端适配实践主要涉及哪些技术？」），禁止问「训练哪项技能」「考核学生哪些能力」「…的目标是什么」。",
            f"3. 严格按照技能模板中的JSON格式输出；question_text 只写题目本身，禁止「基于xx生成」「本课程」「目标要求」「…的目标是什么」等前缀。",
            f"4. 选择题(choice)的 options 只写选项内容，不要加 \"A.\"、\"B.\"、\"C.\"、\"D.\"，例如: [\"内容1\", \"内容2\", \"内容3\", \"内容4\"]",
            f"5. 判断题(judge)的 options 为 [\"正确\", \"错误\"]，不要加 A/B 前缀",
            f"6. 问答题(essay)的options必须是空数组: []",
            f"7. 确保所有答案准确无误，且必须基于知识点内容（非课程元信息）",
            f"8. **不得出现错别字**：题目、选项、解析中的用字、用词须准确规范，严禁错别字、别字、漏字或明显笔误。",
            f"9. 每题必须有解析（30–50字，简明扼要）：解析须与正确答案一致、确保正确；**解析中禁止**出现「学生」「要求学生」「让学生」「培养学生」「提升学生」「考核学生」「该实验/实训的目标」「旨在」「核心目标是」等字样；解析应**直接说明技术要点或答案依据**，不要描述教学目的、学生行为或考核目的；可结合知识点与通用表述来写。",
            f"10. 分数分配合理，总分接近100分",
            f"11. 每题必须标注 knowledge_source（须为知识点/章节，不能为课程基本信息）",
            f"12. 只输出JSON，不要有任何其他文字或markdown标记",
            f"13. **题目不重复**：同一知识点可变换问法、选项顺序或考查角度，确保本次生成的题目与常见题、以往生成均不雷同。",
            f"",
            f"⚠️ 特别注意：不得出课程元信息、思政、考核、学生规范类题；只出考查概念/定义/原理/技术的知识点题；题干和解析均**禁止「学生」及教学/考核视角**；题干只问技术/知识点本身；解析只写技术要点或答案依据；**题目、选项、解析均不得出现错别字**；检索到的各章节/实验/实训须全覆盖；解析必须正确；options 必填；每次生成题目须有新意、不重复。",
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
                max_tokens=8192   # DeepSeek 上限 8192；20题+解析尽量控制在以内，避免截断
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
            "- 只输出纯JSON，不要有markdown代码块（如```json）或前后说明文字",
            "- 确保JSON格式正确可解析，不要使用尾部逗号（如 ,] 或 ,}）",
            "- 所有必需字段都要填写完整"
        ]
        
        return "\n".join(parts)

    def _try_repair_truncated_json(self, raw: str) -> str:
        """尝试修复截断的 JSON（未闭合的字符串、未闭合的 [] 与 {}）"""
        s = raw.rstrip()
        in_string = False
        escape = False
        quote = None
        brace_depth = 0  # {}
        bracket_depth = 0  # []
        for i, c in enumerate(s):
            if escape:
                escape = False
                continue
            if c == "\\" and in_string:
                escape = True
                continue
            if in_string:
                if c == quote:
                    in_string = False
                continue
            if c in ('"', "'"):
                in_string = True
                quote = c
                continue
            if c == "{":
                brace_depth += 1
            elif c == "}":
                brace_depth -= 1
            elif c == "[":
                bracket_depth += 1
            elif c == "]":
                bracket_depth -= 1
        if in_string:
            s = s + quote
        # 先闭合数组再闭合对象
        while bracket_depth > 0:
            s = s + "]"
            bracket_depth -= 1
        while brace_depth > 0:
            s = s + "}"
            brace_depth -= 1
        return s

    def _remove_trailing_commas(self, s: str) -> str:
        """去掉 JSON 中不合法的尾部逗号（如 ,] 或 ,}），便于解析"""
        # 去掉 ,] 和 ,}
        s = re.sub(r',(\s*])', r'\1', s)
        s = re.sub(r',(\s*})', r'\1', s)
        return s

    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """
        解析AI返回的JSON响应 - 处理各种格式，含截断修复、尾部逗号、markdown 代码块
        """
        cleaned_text = response_text.strip()
        # 去掉 markdown 代码块
        if cleaned_text.startswith("```"):
            lines = cleaned_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned_text = "\n".join(lines).strip()
        # 去掉可能的前后说明文字，只保留第一个 { ... } 或从第一个 { 开始
        json_match = re.search(r'\{.*', cleaned_text, re.DOTALL)
        if json_match:
            cleaned_text = json_match.group()

        def parse(s: str):
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return None

        # 先尝试去掉尾部逗号再解析
        cleaned_text = self._remove_trailing_commas(cleaned_text)
        data = parse(cleaned_text)
        if data is not None:
            return self._validate_and_fix_parsed_data(data)

        repaired = self._try_repair_truncated_json(cleaned_text)
        data = parse(repaired)
        if data is not None:
            return self._validate_and_fix_parsed_data(data)

        raise ValueError(
            f"无法解析AI返回的JSON，请重试或缩短描述以减少输出长度。\n原始响应前500字: {response_text[:500]}"
        )

    @staticmethod
    def _strip_option_label(text: str) -> str:
        """去掉选项前的 A. / B. / C. / D. 前缀，只保留内容"""
        if not text or not isinstance(text, str):
            return (text or "").strip()
        t = text.strip()
        for prefix in ("A.", "B.", "C.", "D.", "A．", "B．", "C．", "D．"):
            if t.startswith(prefix):
                return t[len(prefix):].strip()
        return t

    def _validate_and_fix_parsed_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """校验并修复解析后的问卷数据（必需字段、options 等）；选项统一为仅内容，不带 A/B/C/D 前缀"""
        
        required_fields = ["survey_title", "description", "questions"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"生成的问卷缺少必需字段: {field}")
        if not isinstance(data.get("questions"), list) or len(data["questions"]) == 0:
            raise ValueError("生成的问卷没有题目")

        for idx, question in enumerate(data["questions"], 1):
            q_type = question.get("question_type")
            options = question.get("options", [])
            
            # 选择题必须有4个选项；选项内容去掉 A./B./C./D. 前缀
            if q_type == "choice":
                if not options or len(options) < 4:
                    print(f"⚠️  警告: 第{idx}题（选择题）缺少选项，自动补充标准选项")
                    question["options"] = ["选项A", "选项B", "选项C", "选项D"]
                else:
                    if len(options) > 4:
                        options = options[:4]
                    question["options"] = [self._strip_option_label(str(o)) for o in options]
            
            # 判断题必须有2个选项；去掉 A/B 前缀
            elif q_type == "judge":
                if not options or len(options) < 2:
                    print(f"⚠️  警告: 第{idx}题（判断题）缺少选项，自动补充正确/错误选项")
                    question["options"] = ["正确", "错误"]
                else:
                    opts = [self._strip_option_label(str(o)) for o in options[:2]]
                    question["options"] = ["正确", "错误"] if opts != ["正确", "错误"] else opts
            
            # 问答题确保options是空数组
            elif q_type == "essay":
                question["options"] = []
        
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
