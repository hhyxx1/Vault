"""
问答题AI智能打分服务
基于AI对学生的问答题进行智能评分
支持动态Skill生成 - 针对不同科目/知识点生成专门的评分标准
"""

import json
import os
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime

from app.services.ai_service import ai_service
from app.services.skill_loader import SkillLoader, Skill


class EssayGradingService:
    """问答题AI打分服务 - 支持动态Skill生成"""
    
    def __init__(self):
        self.ai_service = ai_service
        self.skill_file = Path(__file__).parent.parent.parent / "skills" / "essay_grading.md"
        # 初始化Skill加载器
        self.skill_loader = SkillLoader()
        self.skill_loader.load_skills()
        # 向量数据库（用于检索相关知识）
        self._vector_db = None
    
    @property
    def vector_db(self):
        """延迟加载向量数据库"""
        if self._vector_db is None:
            try:
                from app.services.vector_db_service import get_vector_db
                self._vector_db = get_vector_db()
            except Exception as e:
                print(f"⚠️ 无法加载向量数据库: {e}")
        return self._vector_db
    
    async def grade_essay(
        self,
        question_text: str,
        question_type: str,
        reference_answer: str,
        student_answer: str,
        max_score: float = 100,
        grading_criteria: Optional[Dict[str, Any]] = None,
        min_word_count: Optional[int] = None,
        # 新增参数：用于动态生成更精准的评分Skill
        knowledge_points: Optional[List[str]] = None,
        course_name: Optional[str] = None,
        survey_title: Optional[str] = None,
        course_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        对问答题进行AI打分 - 支持动态Skill和知识库检索
        
        Args:
            question_text: 题目文本
            question_type: 题目类型 (essay/text)
            reference_answer: 参考答案
            grading_criteria: 评分标准
            min_word_count: 最小字数要求
            student_answer: 学生答案
            max_score: 题目满分
            knowledge_points: 知识点列表（用于精准评分）
            course_name: 课程名称（用于生成专业评分标准）
            survey_title: 问卷标题
            course_id: 课程ID（用于检索知识库）
            
        Returns:
            打分结果，包含分数、评语等
        """
        print(f"📝 开始AI智能打分")
        print(f"题目: {question_text[:50]}...")
        print(f"学生答案: {student_answer[:100] if student_answer else '(空)'}...")
        print(f"满分: {max_score}")
        print(f"知识点: {knowledge_points}")
        print(f"课程: {course_name}")
        
        dynamic_skill = None
        knowledge_context = ""
        
        try:
            # 1. 检索相关知识库内容（提高评分准确性）
            if course_id or knowledge_points:
                knowledge_context = await self._retrieve_knowledge_context(
                    question_text=question_text,
                    knowledge_points=knowledge_points,
                    course_id=course_id
                )
                if knowledge_context:
                    print(f"✅ 检索到相关知识内容: {len(knowledge_context)} 字符")
            
            # 2. 动态生成专门的评分Skill（针对特定科目/知识点）
            if knowledge_points or course_name:
                dynamic_skill = await self._generate_grading_skill(
                    knowledge_points=knowledge_points,
                    course_name=course_name,
                    survey_title=survey_title,
                    question_text=question_text,
                    grading_criteria=grading_criteria
                )
                if dynamic_skill:
                    print(f"✅ 动态生成评分Skill: {dynamic_skill.name}")
            
            # 3. 读取基础skill文件
            base_skill_content = self._load_skill_file()
            
            # 4. 合并Skill内容
            skill_content = base_skill_content
            if dynamic_skill:
                skill_content = f"""
{dynamic_skill.content}

---
以下是基础评分原则，请结合上述专业评分标准使用：
---

{base_skill_content}
"""
            
            # 5. 构建打分prompt（包含知识库内容）
            prompt = self._build_grading_prompt(
                question_text=question_text,
                question_type=question_type,
                reference_answer=reference_answer,
                grading_criteria=grading_criteria,
                min_word_count=min_word_count,
                student_answer=student_answer,
                max_score=max_score,
                skill_content=skill_content,
                knowledge_context=knowledge_context,
                knowledge_points=knowledge_points
            )
            
            # 6. 调用AI进行打分
            result = await self.ai_service.generate_content(prompt)
            
            # 7. 解析AI返回的JSON
            grading_result = self._parse_grading_result(result)
            
            print(f"✅ AI打分完成: 得分={grading_result.get('score')}, 等级={grading_result.get('level')}")
            
            return grading_result
            
        except Exception as e:
            print(f"❌ AI打分失败: {e}")
            import traceback
            traceback.print_exc()
            # 返回默认评分
            return self._get_default_grading(student_answer, max_score)
            
        finally:
            # 8. 清理动态生成的Skill（打分完成后自动删除）
            if dynamic_skill and dynamic_skill.is_dynamic:
                try:
                    self.skill_loader.delete_dynamic_skill(dynamic_skill)
                    print(f"🗑️ 已清理临时评分Skill: {dynamic_skill.name}")
                except Exception as e:
                    print(f"⚠️ 清理临时Skill失败: {e}")
    
    async def _retrieve_knowledge_context(
        self,
        question_text: str,
        knowledge_points: Optional[List[str]] = None,
        course_id: Optional[str] = None
    ) -> str:
        """检索相关知识库内容，用于辅助评分"""
        if not self.vector_db:
            return ""
        
        try:
            # 构建检索查询
            search_query = question_text
            if knowledge_points:
                search_query += " " + " ".join(knowledge_points)
            
            # 搜索相关知识
            if hasattr(self.vector_db, 'search_relevant_context'):
                results = self.vector_db.search_relevant_context(
                    search_query,
                    top_k=3  # 只取最相关的3条
                )
                
                if results:
                    contexts = []
                    for r in results:
                        content = r.get("content", r.get("page_content", ""))
                        if content:
                            contexts.append(content[:500])  # 限制每条内容长度
                    
                    return "\n\n".join(contexts)
        except Exception as e:
            print(f"⚠️ 知识库检索失败: {e}")
        
        return ""
    
    async def _generate_grading_skill(
        self,
        knowledge_points: Optional[List[str]] = None,
        course_name: Optional[str] = None,
        survey_title: Optional[str] = None,
        question_text: Optional[str] = None,
        grading_criteria: Optional[Dict[str, Any]] = None
    ) -> Optional[Skill]:
        """
        根据科目和知识点动态生成专门的评分Skill
        
        这个Skill会包含针对特定领域的评分标准和专业术语要求
        """
        if not knowledge_points and not course_name:
            return None
        
        try:
            # 生成Skill名称
            skill_name = f"评分专家"
            if course_name:
                skill_name = f"{course_name}评分专家"
            elif knowledge_points:
                skill_name = f"{knowledge_points[0]}评分专家"
            
            # 构建动态评分标准
            knowledge_str = ", ".join(knowledge_points) if knowledge_points else "通用知识"
            criteria_str = ""
            if grading_criteria:
                criteria_str = f"\n\n### 自定义评分标准\n{json.dumps(grading_criteria, ensure_ascii=False, indent=2)}"
            
            skill_description = f"针对{course_name or '该课程'}的{knowledge_str}相关问题的专业评分专家"
            
            # 构建Skill内容
            skill_content = f"""# {skill_name}

{skill_description}

## 专业领域
- 课程: {course_name or '通用'}
- 知识点: {knowledge_str}
- 问卷: {survey_title or '未知'}

## 专业评分原则

### 1. 专业术语准确性（权重：30%）
- 学生答案中的专业术语是否准确
- 是否正确使用了「{knowledge_str}」相关的核心概念
- 术语的使用是否符合{course_name or '该领域'}的规范

### 2. 知识点覆盖度（权重：35%）
- 是否覆盖了题目要求的核心知识点
- 重点知识点：{knowledge_str}
- 检查是否遗漏关键要点

### 3. 逻辑性与深度（权重：25%）
- 答案的逻辑结构是否清晰
- 是否有深入的理解和分析
- 是否能正确解释原理和联系

### 4. 表达规范性（权重：10%）
- 语言表达是否专业、规范
- 是否符合{course_name or '该学科'}的表达习惯
{criteria_str}

## 评分等级标准
- 满分(90-100%): 专业术语准确，知识点全面，有深入理解
- 优秀(80-89%): 术语基本准确，覆盖主要知识点，理解正确
- 良好(70-79%): 部分术语准确，覆盖部分知识点，有一定理解
- 及格(60-69%): 有相关内容，但术语和知识点有明显欠缺
- 不及格(<60%): 答案与题目要求相差较大，缺乏核心知识点

## 特别注意
1. 作为{course_name or '该领域'}的评分专家，要特别关注专业性
2. 对于「{knowledge_str}」相关内容，要严格检查准确性
3. 鼓励学生的独到见解，但前提是基础概念正确
"""
            
            # 创建动态Skill（设置为临时文件，用完删除）
            skill = self.skill_loader.create_dynamic_skill(
                name=skill_name,
                description=skill_description,
                content=skill_content,
                save_to_file=True
            )
            
            return skill
            
        except Exception as e:
            print(f"⚠️ 生成动态评分Skill失败: {e}")
            return None
    
    def _load_skill_file(self) -> str:
        """加载skill文件内容"""
        try:
            with open(self.skill_file, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"⚠️ 加载skill文件失败: {e}")
            return ""
    
    def _build_grading_prompt(
        self,
        question_text: str,
        question_type: str,
        reference_answer: str,
        grading_criteria: Optional[Dict[str, Any]],
        min_word_count: Optional[int],
        student_answer: str,
        max_score: float,
        skill_content: str,
        knowledge_context: str = "",
        knowledge_points: Optional[List[str]] = None
    ) -> str:
        """构建打分prompt - 包含知识库内容和知识点信息"""
        
        prompt = f"""你是一个专业的教育评分专家,请根据以下要求对学生的问答题进行**精准、严格**的评分。

## 题目信息
- 题目类型: {question_type}
- 题目内容: {question_text}
- 题目满分: {max_score}分
"""
        
        # 添加知识点信息（重要：用于精准评分）
        if knowledge_points:
            prompt += f"- 考查知识点: {', '.join(knowledge_points)}\n"
            prompt += f"  **重要**: 学生答案必须正确覆盖这些知识点才能得高分!\n"
        
        if reference_answer:
            prompt += f"- 参考答案: {reference_answer}\n"
            prompt += f"  **重要**: 学生答案应与参考答案的核心要点一致!\n"
        
        if grading_criteria:
            prompt += f"- 评分标准: {json.dumps(grading_criteria, ensure_ascii=False)}\n"
        
        if min_word_count:
            prompt += f"- 最小字数要求: {min_word_count}字\n"
        
        # 添加知识库参考内容（提高评分准确性）
        if knowledge_context:
            prompt += f"""
## 权威知识库参考（用于验证学生答案的准确性）
以下是从课程知识库中检索到的相关内容，请用于核实学生答案的正确性：

{knowledge_context}

**重要**: 请对照上述权威知识内容，检查学生答案中的概念、定义、原理是否准确！
"""
        
        prompt += f"""
## 学生答案
{student_answer if student_answer else "(学生未作答)"}

## 精准评分要求
"""
        
        if skill_content:
            prompt += f"""
请严格按照以下专业评分标准进行评分:

{skill_content}
"""
        else:
            prompt += """
请按照以下原则进行**严格、精准**的打分:

### 评分核心原则
1. **准确性优先**: 概念、术语、原理必须正确，错误的内容要扣分
2. **覆盖度检查**: 是否回答了题目要求的所有要点
3. **深度评估**: 是否有深入理解，而非表面回答
4. **严谨客观**: 有理有据，不能主观臆断

### 评分权重分配
- 核心概念准确性(35%): 关键术语、定义、原理是否正确
- 知识点覆盖度(35%): 是否覆盖了题目要求的所有要点
- 理解深度(20%): 是否深入理解，有逻辑推理
- 表达清晰度(10%): 语言表达是否清晰、有条理

### 扣分标准
- 核心概念错误: 每处扣5-10%
- 遗漏重要知识点: 每个扣5-8%
- 理解偏差: 酌情扣3-5%
- 表达混乱: 酌情扣2-5%
"""
        
        prompt += f"""
## 输出要求
必须严格按照以下JSON格式输出,不要有任何其他文字:

```json
{{
  "score": 分数（必须是数字，精确到小数点后1位）,
  "max_score": {max_score},
  "percentage": 百分比（精确到小数点后1位）,
  "level": "等级(满分/优秀/良好/及格/不及格)",
  "score_breakdown": {{
    "accuracy": 准确性得分（满分{max_score * 0.35:.1f}）,
    "coverage": 知识点覆盖度得分（满分{max_score * 0.35:.1f}）,
    "depth": 理解深度得分（满分{max_score * 0.20:.1f}）,
    "expression": 表达清晰度得分（满分{max_score * 0.10:.1f}）
  }},
  "key_points_check": [
    {{"point": "知识点1", "correct": true/false, "feedback": "具体反馈"}},
    {{"point": "知识点2", "correct": true/false, "feedback": "具体反馈"}}
  ],
  "errors_found": ["错误1", "错误2"],
  "strengths": ["优点1", "优点2"],
  "areas_for_improvement": ["改进建议1", "改进建议2"],
  "comment": "综合评语（客观、具体、有建设性）",
  "detailed_feedback": [
    {{
      "point": "评分维度",
      "score": 得分,
      "max_score": 该维度满分,
      "feedback": "具体反馈"
    }}
  ]
}}
```

## 评分注意事项
1. **严格对照参考答案**: 如果有参考答案，学生答案必须与核心要点一致
2. **检查知识点覆盖**: 如果指定了知识点，必须检查是否全部覆盖
3. **利用知识库验证**: 如果有知识库内容，用它来验证学生答案的准确性
4. **发现错误要扣分**: 概念错误、术语不准确必须体现在分数中
5. **空答案或无关答案**: 得分应为0或极低分
6. score必须是数字,不能超过max_score
7. percentage = (score / max_score) * 100
8. level标准: 90%以上=满分, 80-89%=优秀, 70-79%=良好, 60-69%=及格, 60%以下=不及格
9. 评语要客观、具体，既指出问题也给出建议
10. 只输出JSON,不要有任何markdown标记或其他文字
"""
        
        return prompt
    
    def _parse_grading_result(self, result: str) -> Dict[str, Any]:
        """解析AI返回的打分结果"""
        if not result or not result.strip():
            print(f"⚠️ AI返回结果为空")
            raise ValueError("AI返回结果为空")
        
        try:
            cleaned_result = result.strip()
            if cleaned_result.startswith('```json'):
                cleaned_result = cleaned_result[7:]
            if cleaned_result.startswith('```'):
                cleaned_result = cleaned_result[3:]
            if cleaned_result.endswith('```'):
                cleaned_result = cleaned_result[:-3]
            cleaned_result = cleaned_result.strip()
            
            parsed = json.loads(cleaned_result)
            
            if not isinstance(parsed, dict):
                print(f"⚠️ AI返回结果不是字典类型")
                raise ValueError("AI返回结果格式错误")
            
            required_fields = ['score', 'max_score', 'percentage', 'level']
            for field in required_fields:
                if field not in parsed:
                    print(f"⚠️ AI返回结果缺少必需字段: {field}")
                    raise ValueError(f"AI返回结果缺少必需字段: {field}")
            
            if not isinstance(parsed['score'], (int, float)):
                print(f"⚠️ score字段类型错误")
                raise ValueError("score字段必须是数字")
            
            if not isinstance(parsed['max_score'], (int, float)):
                print(f"⚠️ max_score字段类型错误")
                raise ValueError("max_score字段必须是数字")
            
            if parsed['score'] > parsed['max_score']:
                print(f"⚠️ score超过max_score")
                parsed['score'] = parsed['max_score']
                parsed['percentage'] = 100.0
                parsed['level'] = '满分'
            
            if parsed['score'] < 0:
                print(f"⚠️ score为负数")
                parsed['score'] = 0
                parsed['percentage'] = 0.0
                parsed['level'] = '不及格'
            
            if 'strengths' not in parsed or not parsed['strengths']:
                parsed['strengths'] = ["完成了作答", "有一定的思考"]
            
            if 'areas_for_improvement' not in parsed or not parsed['areas_for_improvement']:
                parsed['areas_for_improvement'] = ["建议更深入地理解题目"]
            
            if 'comment' not in parsed or not parsed['comment']:
                parsed['comment'] = "感谢你的作答。建议你多复习相关知识,加强对概念的理解。相信通过努力,你会有更大的进步!"
            
            if 'score_breakdown' not in parsed:
                parsed['score_breakdown'] = {
                    "content_completeness": round(parsed['score'] * 0.4, 1),
                    "accuracy": round(parsed['score'] * 0.35, 1),
                    "depth": round(parsed['score'] * 0.2, 1),
                    "expression": round(parsed['score'] * 0.05, 1)
                }
            
            if 'detailed_feedback' not in parsed:
                parsed['detailed_feedback'] = [
                    {
                        "point": "内容完整性",
                        "score": parsed['score_breakdown']['content_completeness'],
                        "max_score": round(parsed['max_score'] * 0.4, 1),
                        "feedback": "基于AI评分的基础评分"
                    }
                ]
            
            return parsed
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON解析失败: {e}")
            raise ValueError(f"JSON解析失败: {e}")
        except Exception as e:
            print(f"⚠️ 解析AI返回结果失败: {e}")
            raise ValueError(f"解析AI返回结果失败: {e}")
    
    def _get_default_grading(self, student_answer: str, max_score: float) -> Dict[str, Any]:
        """获取默认评分（当AI打分失败时）"""
        
        # 根据答案长度给一个基础分
        answer_length = len(student_answer.strip())
        
        if answer_length == 0:
            score = 0
            level = "不及格"
        elif answer_length < 50:
            score = max_score * 0.4
            level = "不及格"
        elif answer_length < 100:
            score = max_score * 0.6
            level = "及格"
        elif answer_length < 200:
            score = max_score * 0.75
            level = "良好"
        else:
            score = max_score * 0.85
            level = "优秀"
        
        percentage = (score / max_score) * 100 if max_score > 0 else 0
        
        return {
            "score": round(score, 1),
            "max_score": max_score,
            "percentage": round(percentage, 1),
            "level": level,
            "score_breakdown": {
                "content_completeness": round(score * 0.4, 1),
                "accuracy": round(score * 0.35, 1),
                "depth": round(score * 0.2, 1),
                "expression": round(score * 0.05, 1)
            },
            "strengths": [
                "完成了作答",
                "有一定的思考"
            ],
            "areas_for_improvement": [
                "建议更深入地理解题目",
                "可以尝试更详细地阐述观点"
            ],
            "comment": "感谢你的作答。建议你多复习相关知识，加强对概念的理解。相信通过努力，你会有更大的进步！",
            "detailed_feedback": [
                {
                    "point": "内容完整性",
                    "score": round(score * 0.4, 1),
                    "max_score": round(max_score * 0.4, 1),
                    "feedback": "基于答案长度的基础评分"
                }
            ]
        }


# 创建全局实例
essay_grading_service = EssayGradingService()
