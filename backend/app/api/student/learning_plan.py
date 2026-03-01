"""
学习计划 API - 学生端
分析学生的测试能力答题情况，生成个性化学习计划
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional
import json
import os
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models.survey import Survey, Question, SurveyResponse, Answer
from app.models.user import User, Student
from app.utils.auth import get_current_user

router = APIRouter(tags=["学习计划"])


def decimal_to_float(obj):
    """将 Decimal 类型转换为 float"""
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _get_learning_analysis_impl(db: Session, student_id: str, include_all_types: bool = False):
    """
    内部实现函数：获取学生的学习分析数据
    可以被多个API endpoint复用
    
    Args:
        db: 数据库会话
        student_id: 学生ID
        include_all_types: 是否包含所有类型的问卷（不仅仅是ability_test）
    """
    print(f"[DEBUG] _get_learning_analysis_impl - student_id: {student_id}, include_all_types: {include_all_types}")
    
    try:
        # 获取学生信息
        user = db.query(User).filter(User.id == student_id).first()
        print(f"[DEBUG] user found: {user}")
        student = db.query(Student).filter(Student.user_id == student_id).first()
        print(f"[DEBUG] student found: {student}")
        
        # 使用 full_name 或 username 作为学生名
        student_name = (user.full_name if user and user.full_name else 
                       (user.username if user else "学生"))
        print(f"[DEBUG] student_name: {student_name}")
    except Exception as e:
        print(f"[ERROR] Failed to get user/student info: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    try:
        # 获取问卷：可以选择只获取ability_test或所有类型
        if include_all_types:
            # 获取所有已发布且成绩已发布的问卷
            surveys = db.query(Survey).filter(
                and_(
                    Survey.status == 'published',
                    Survey.score_published == True
                )
            ).all()
            print(f"[DEBUG] Found {len(surveys)} published surveys with scores")
        else:
            # 只获取测试能力问卷
            surveys = db.query(Survey).filter(
                and_(
                    Survey.release_type == 'ability_test',
                    Survey.status == 'published'
                )
            ).all()
            print(f"[DEBUG] Found {len(surveys)} ability_test surveys")
    except Exception as e:
        print(f"[ERROR] Failed to query surveys: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    if not surveys:
        return {
            "hasData": False,
            "message": "暂无测试能力问卷"
        }
    
    # 收集所有测试结果和错题
    test_results = []
    all_wrong_questions = []
    knowledge_point_stats = {}  # 知识点统计
    
    for survey in surveys:
        # 获取学生的提交记录
        response = db.query(SurveyResponse).filter(
            and_(
                SurveyResponse.survey_id == survey.id,
                SurveyResponse.student_id == student_id,
                SurveyResponse.status == 'completed'
            )
        ).order_by(SurveyResponse.attempt_number.desc()).first()
        
        if not response:
            continue
        
        # 获取问卷的所有题目
        questions = db.query(Question).filter(
            Question.survey_id == survey.id
        ).order_by(Question.question_order).all()
        
        # 获取学生的答案
        answers = db.query(Answer).filter(
            Answer.response_id == response.id
        ).all()
        
        answer_map = {str(ans.question_id): ans for ans in answers}
        
        wrong_questions = []
        
        for q in questions:
            q_id = str(q.id)
            ans = answer_map.get(q_id)
            
            # 统计知识点
            kps = q.knowledge_points or []
            for kp in kps:
                if kp not in knowledge_point_stats:
                    knowledge_point_stats[kp] = {
                        "total_questions": 0,
                        "correct_count": 0,
                        "wrong_count": 0
                    }
                knowledge_point_stats[kp]["total_questions"] += 1
                
                if ans and ans.is_correct:
                    knowledge_point_stats[kp]["correct_count"] += 1
                else:
                    knowledge_point_stats[kp]["wrong_count"] += 1
            
            # 记录错题
            if ans and not ans.is_correct:
                wrong_q = {
                    "surveyTitle": survey.title,
                    "questionText": q.question_text,
                    "questionType": q.question_type,
                    "knowledgePoints": kps,
                    "studentAnswer": ans.student_answer,
                    "correctAnswer": q.correct_answer,
                    "score": decimal_to_float(ans.score) if ans.score else 0,
                    "maxScore": decimal_to_float(q.score) if q.score else 0,
                    "answerExplanation": q.answer_explanation
                }
                wrong_questions.append(wrong_q)
                all_wrong_questions.append(wrong_q)
        
        # 记录测试结果
        test_results.append({
            "surveyId": str(survey.id),
            "surveyTitle": survey.title,
            "submitTime": response.submit_time.isoformat() if response.submit_time else None,
            "totalScore": decimal_to_float(response.total_score),
            "percentageScore": decimal_to_float(response.percentage_score),
            "isPassed": response.is_passed,
            "totalQuestions": len(questions),
            "correctCount": len(questions) - len(wrong_questions),
            "wrongCount": len(wrong_questions),
            "wrongQuestions": wrong_questions
        })
    
    if not test_results:
        return {
            "hasData": False,
            "message": "您还没有完成任何测试能力问卷"
        }
    
    # 计算知识点正确率
    for kp, stats in knowledge_point_stats.items():
        if stats["total_questions"] > 0:
            stats["accuracy_rate"] = round(
                stats["correct_count"] / stats["total_questions"], 2
            )
        else:
            stats["accuracy_rate"] = 0
    
    # 找出薄弱知识点（正确率低于60%）
    weak_points = [
        {
            "name": kp,
            "totalQuestions": stats["total_questions"],
            "correctCount": stats["correct_count"],
            "wrongCount": stats["wrong_count"],
            "accuracyRate": stats["accuracy_rate"]
        }
        for kp, stats in knowledge_point_stats.items()
        if stats["accuracy_rate"] < 0.6 and stats["total_questions"] >= 1
    ]
    
    # 按正确率排序（从低到高）
    weak_points.sort(key=lambda x: x["accuracyRate"])
    
    # 计算整体统计
    total_questions = sum(t["totalQuestions"] for t in test_results)
    total_correct = sum(t["correctCount"] for t in test_results)
    overall_accuracy = round(total_correct / total_questions, 2) if total_questions > 0 else 0
    avg_score = round(
        sum(t["percentageScore"] or 0 for t in test_results) / len(test_results), 1
    ) if test_results else 0
    
    return {
        "hasData": True,
        "studentName": student_name,
        "overallStats": {
            "totalTests": len(test_results),
            "totalQuestions": total_questions,
            "totalCorrect": total_correct,
            "totalWrong": total_questions - total_correct,
            "overallAccuracy": overall_accuracy,
            "averageScore": avg_score
        },
        "testResults": test_results,
        "knowledgePointStats": knowledge_point_stats,
        "weakPoints": weak_points,
        "allWrongQuestions": all_wrong_questions
    }


@router.get("/analysis")
async def get_learning_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取学生的学习分析数据
    分析所有已完成且成绩已发布的测试能力问卷
    """
    try:
        student_id = str(current_user.id)
        return _get_learning_analysis_impl(db, student_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取学习分析失败: {str(e)}")


@router.post("/generate")
async def generate_learning_plan(
    include_all: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    基于学习分析数据，使用AI生成个性化学习计划
    
    Args:
        include_all: 是否包含所有类型问卷的成绩（不仅仅是能力测试）
    """
    try:
        # 先获取分析数据
        student_id = str(current_user.id)
        analysis = _get_learning_analysis_impl(db, student_id, include_all_types=include_all)
        
        if not analysis.get("hasData"):
            return {
                "success": False,
                "message": analysis.get("message", "没有足够的数据生成学习计划")
            }
        
        # 读取 skill 文件
        skill_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "skills",
            "learning_plan_generation.md"
        )
        
        skill_content = ""
        if os.path.exists(skill_path):
            with open(skill_path, "r", encoding="utf-8") as f:
                skill_content = f.read()
        
        # 获取课程名称列表（从测试结果中提取）
        course_names = list(set(t["surveyTitle"].split("_")[0] if "_" in t["surveyTitle"] else t["surveyTitle"] 
                               for t in analysis["testResults"]))
        
        # 准备输入数据
        input_data = {
            "student_name": analysis["studentName"],
            "course_names": course_names,
            "overall_stats": analysis["overallStats"],
            "test_results": [
                {
                    "survey_title": t["surveyTitle"],
                    "submit_time": t["submitTime"],
                    "total_score": t["totalScore"],
                    "percentage_score": t["percentageScore"],
                    "is_passed": t["isPassed"],
                    "total_questions": t["totalQuestions"],
                    "correct_count": t["correctCount"],
                    "wrong_count": t["wrongCount"],
                    "wrong_questions": t["wrongQuestions"][:5]  # 限制数量避免太长
                }
                for t in analysis["testResults"]
            ],
            "knowledge_point_stats": analysis["knowledgePointStats"],
            "weak_points": analysis["weakPoints"]
        }
        
        # 调用 AI 生成学习计划
        from app.services.ai_service import get_ai_response
        
        prompt = f"""你是一个专业的学习规划师和教育专家。请根据以下学生的测试数据，生成一个**详细的个性化学习计划**。

## 技能指南
{skill_content}

## 学生测试数据
{json.dumps(input_data, ensure_ascii=False, indent=2)}

## 特别要求

### 1. 生成个性化学习大纲
基于学生的薄弱知识点，生成一个系统的学习大纲，包含：
- 需要掌握的核心概念和定义
- 知识点之间的关联关系
- 学习的先后顺序（先学什么，后学什么）

### 2. 能力分析与推荐
根据测试成绩分析学生的能力水平：
- 哪些能力已经具备（如：概念理解、应用分析、综合运用等）
- 哪些能力需要提升
- 针对每种能力的提升建议

### 3. 重点学习内容
明确指出学生需要**重点学习**的内容：
- 高优先级：必须掌握的核心知识点（正确率<50%）
- 中优先级：需要加强的知识点（正确率50%-70%）
- 巩固性：已掌握但需要巩固的知识点（正确率>70%）

### 4. 具体学习建议
针对每个薄弱知识点，给出：
- 学习方法（怎么学）
- 学习资源（看什么）
- 练习建议（做什么题）
- 预计时间（需要多久）

## 输出格式要求
请严格按照以下 JSON 格式输出：

```json
{{
  "overall_assessment": {{
    "summary": "整体评估（200字左右，包含能力分析）",
    "ability_analysis": {{
      "strong_abilities": ["已具备的能力1", "已具备的能力2"],
      "weak_abilities": ["需提升的能力1", "需提升的能力2"],
      "ability_score": {{
        "concept_understanding": 80,
        "application": 65,
        "analysis": 70,
        "synthesis": 55
      }}
    }},
    "strengths": ["掌握较好的方面1", "掌握较好的方面2"],
    "weaknesses": ["薄弱点1", "薄弱点2"],
    "improvement_potential": "high/medium/low"
  }},
  "learning_outline": {{
    "title": "个性化学习大纲",
    "description": "大纲说明",
    "modules": [
      {{
        "module_name": "模块名称",
        "priority": "high/medium/low",
        "knowledge_points": [
          {{
            "name": "知识点名称",
            "importance": "核心/重要/基础",
            "current_mastery": "掌握程度描述",
            "target_mastery": "目标掌握程度"
          }}
        ],
        "prerequisites": ["前置知识点"],
        "learning_order": 1
      }}
    ]
  }},
  "focus_areas": {{
    "high_priority": [
      {{
        "knowledge_point": "知识点名称",
        "accuracy_rate": 0.3,
        "reason": "为什么需要重点学习",
        "study_method": "具体学习方法",
        "resources": ["推荐资源1", "推荐资源2"],
        "practice_type": "建议的练习类型",
        "estimated_time": "预计学习时间"
      }}
    ],
    "medium_priority": [],
    "consolidation": []
  }},
  "learning_plan": {{
    "total_duration": "建议学习总时长",
    "daily_time": "每日建议学习时间",
    "phases": [
      {{
        "phase_number": 1,
        "phase_name": "阶段名称",
        "duration": "阶段时长",
        "focus": "本阶段重点",
        "goals": ["阶段目标1", "阶段目标2"],
        "tasks": [
          {{
            "task_name": "任务名称",
            "description": "详细描述怎么做",
            "knowledge_points": ["相关知识点"],
            "estimated_time": "预计用时",
            "resources": ["推荐资源"],
            "practice_suggestions": "练习建议"
          }}
        ],
        "milestone": "阶段里程碑"
      }}
    ]
  }},
  "study_methods": [
    {{
      "method_name": "学习方法名称",
      "description": "方法详细描述",
      "applicable_for": ["适用的知识点"],
      "tips": ["技巧1", "技巧2"]
    }}
  ],
  "motivation_message": "鼓励性话语（给学生信心和动力，200字左右）"
}}
```

## 注意事项
1. 只输出JSON，不要有其他内容
2. 语言要亲切、鼓励性
3. 计划要具体可执行
4. 重点突出薄弱知识点的改进方案

请生成学习计划："""

        try:
            ai_response = await get_ai_response(prompt)
            
            # 尝试解析 JSON
            response_text = ai_response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            learning_plan = json.loads(response_text)
            
            return {
                "success": True,
                "learningPlan": learning_plan,
                "analysisData": analysis,
                "generatedAt": datetime.utcnow().isoformat()
            }
            
        except json.JSONDecodeError as e:
            # 如果 AI 返回的不是有效 JSON，返回原始文本
            return {
                "success": True,
                "learningPlan": None,
                "rawResponse": ai_response,
                "analysisData": analysis,
                "generatedAt": datetime.utcnow().isoformat(),
                "parseError": str(e)
            }
        except Exception as e:
            # AI 服务调用失败，返回基础分析
            return {
                "success": False,
                "message": f"AI生成学习计划失败: {str(e)}",
                "analysisData": analysis
            }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"生成学习计划失败: {str(e)}")


@router.get("/weak-points")
async def get_weak_points(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取薄弱知识点列表（简化版，用于快速展示）
    """
    try:
        student_id = str(current_user.id)
        print(f"[DEBUG] get_weak_points - student_id: {student_id}")
        print(f"[DEBUG] get_weak_points - current_user: {current_user}")
        
        analysis = _get_learning_analysis_impl(db, student_id)
        print(f"[DEBUG] get_weak_points - analysis hasData: {analysis.get('hasData')}")
        
        if not analysis.get("hasData"):
            return {
                "hasData": False,
                "weakPoints": []
            }
        
        return {
            "hasData": True,
            "weakPoints": analysis.get("weakPoints", []),
            "overallStats": analysis.get("overallStats", {})
        }
    
    except Exception as e:
        import traceback
        print(f"[ERROR] get_weak_points failed: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取薄弱知识点失败: {str(e)}")
