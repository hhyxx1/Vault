"""
问答题AI智能打分服务
基于AI对学生的问答题进行智能评分
"""

import json
import os
from typing import Dict, Any, Optional
from pathlib import Path

from app.services.ai_service import ai_service


class EssayGradingService:
    """问答题AI打分服务"""
    
    def __init__(self):
        self.ai_service = ai_service
        self.skill_file = Path(__file__).parent.parent.parent / "skills" / "essay_grading.md"
    
    async def grade_essay(
        self,
        question_text: str,
        question_type: str,
        reference_answer: str,
        student_answer: str,
        max_score: float = 100,
        grading_criteria: Optional[Dict[str, Any]] = None,
        min_word_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        对问答题进行AI打分
        
        Args:
            question_text: 题目文本
            question_type: 题目类型 (essay/text)
            reference_answer: 参考答案
            grading_criteria: 评分标准
            min_word_count: 最小字数要求
            student_answer: 学生答案
            max_score: 题目满分
            
        Returns:
            打分结果，包含分数、评语等
        """
        print(f"📝 开始AI打分")
        print(f"题目: {question_text[:50]}...")
        print(f"学生答案: {student_answer[:100]}...")
        print(f"满分: {max_score}")
        
        # 读取skill文件
        skill_content = self._load_skill_file()
        
        # 构建打分prompt
        prompt = self._build_grading_prompt(
            question_text=question_text,
            question_type=question_type,
            reference_answer=reference_answer,
            grading_criteria=grading_criteria,
            min_word_count=min_word_count,
            student_answer=student_answer,
            max_score=max_score,
            skill_content=skill_content
        )
        
        # 调用AI进行打分
        try:
            result = await self.ai_service.generate_content(prompt)
            
            # 解析AI返回的JSON
            grading_result = self._parse_grading_result(result)
            
            print(f"✅ AI打分完成: 得分={grading_result.get('score')}, 等级={grading_result.get('level')}")
            
            return grading_result
            
        except Exception as e:
            print(f"❌ AI打分失败: {e}")
            # 返回默认评分
            return self._get_default_grading(student_answer, max_score)
    
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
        skill_content: str
    ) -> str:
        """构建打分prompt"""
        
        prompt = f"""你是一个专业的教育评分专家,请根据以下要求对学生的问答题进行打分。

## 题目信息
- 题目类型: {question_type}
- 题目内容: {question_text}
- 题目满分: {max_score}分
"""
        
        if reference_answer:
            prompt += f"- 参考答案: {reference_answer}\n"
        
        if grading_criteria:
            prompt += f"- 评分标准: {json.dumps(grading_criteria, ensure_ascii=False)}\n"
        
        if min_word_count:
            prompt += f"- 最小字数要求: {min_word_count}字\n"
        
        prompt += f"""
## 学生答案
{student_answer}

## 打分要求
"""
        
        if skill_content:
            prompt += f"""
请严格按照以下skill文件中的打分原则和标准进行评分:

{skill_content}
"""
        else:
            prompt += """
请按照以下原则进行打分:
1. 严中有爱:坚持评分标准,但也要发现学生的闪光点
2. 理中有情:评分有理有据,评语要体现人文关怀
3. 具体反馈:指出答得好的地方和需要改进的地方
4. 鼓励进步:评语要传递正能量

评分标准:
- 内容完整性(40%):是否覆盖了所有关键要点
- 准确性(35%):核心概念是否正确
- 深度(20%):理解是否深入,是否有独到见解
- 表达(5%):语言表达是否清晰,逻辑是否合理
"""
        
        prompt += """
## 输出要求
必须严格按照以下JSON格式输出,不要有任何其他文字:

```json
{
  "score": 分数,
  "max_score": 满分,
  "percentage": 百分比,
  "level": "等级(满分/优秀/良好/及格/不及格)",
  "score_breakdown": {
    "content_completeness": 内容完整性得分,
    "accuracy": 准确性得分,
    "depth": 深度得分,
    "expression": 表达得分
  },
  "strengths": ["优点1", "优点2", "优点3"],
  "areas_for_improvement": ["改进建议1", "改进建议2"],
  "comment": "综合评语",
  "detailed_feedback": [
    {
      "point": "要点名称",
      "score": 得分,
      "max_score": 满分,
      "feedback": "具体反馈"
    }
  ]
}
```

注意事项:
1. score必须是数字,不能超过max_score
2. percentage = (score / max_score) * 100
3. level根据percentage确定:90%以上=满分,80-89%=优秀,70-79%=良好,60-69%=及格,60%以下=不及格
4. strengths至少要有2-3个优点
5. areas_for_improvement至少要有1-2个改进建议
6. comment要体现人文关怀,既指出优点,也给出建议,传递正能量
7. detailed_feedback要具体,针对每个要点给出反馈
8. 只输出JSON,不要有任何markdown标记或其他文字
9. 所有评语都要用中文,体现人文关怀
10. 对于答案过短或离题的情况,要给予鼓励而不是批评
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
