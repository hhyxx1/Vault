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


def _get_learning_analysis_impl(db: Session, student_id: str):
    """
    内部实现函数：获取学生的学习分析数据
    可以被多个API endpoint复用
    """
    print(f"[DEBUG] _get_learning_analysis_impl - student_id: {student_id}")
    
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
        # 获取所有已发布的测试能力问卷
        # 注意：只要问卷已发布且学生有作答记录就可以分析
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    基于学习分析数据，使用AI生成个性化学习计划
    """
    try:
        # 先获取分析数据
        student_id = str(current_user.id)
        analysis = _get_learning_analysis_impl(db, student_id)
        
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
        
        # 准备输入数据
        input_data = {
            "student_name": analysis["studentName"],
            "course_name": "测试能力综合",
            "overall_stats": analysis["overallStats"],
            "test_results": [
                {
                    "survey_title": t["surveyTitle"],
                    "submit_time": t["submitTime"],
                    "total_score": t["totalScore"],
                    "percentage_score": t["percentageScore"],
                    "is_passed": t["isPassed"],
                    "wrong_questions": t["wrongQuestions"]
                }
                for t in analysis["testResults"]
            ],
            "knowledge_point_stats": analysis["knowledgePointStats"],
            "weak_points": analysis["weakPoints"]
        }
        
        # 调用 AI 生成学习计划
        from app.services.ai_service import get_ai_response
        
        prompt = f"""你是一个专业的学习规划师。请根据以下学生的测试数据，生成一个详细的个性化学习计划。

## 技能指南
{skill_content}

## 学生测试数据
{json.dumps(input_data, ensure_ascii=False, indent=2)}

## 要求
1. 请严格按照技能指南中的输出格式生成 JSON
2. 学习计划要详细、具体、可执行
3. 针对薄弱知识点给出具体的学习方法和资源
4. 语言要鼓励性，让学生有信心
5. 只输出 JSON，不要有其他内容

请生成学习计划："""

        try:
            ai_response = await get_ai_response(prompt)
            
            # 尝试解析 JSON
            # 移除可能的 markdown 代码块标记
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
