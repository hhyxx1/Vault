from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from typing import Literal
import os
import uuid
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.services.document_parser import doc_parser
from app.services.vector_db_service import get_vector_db
from app.database import get_db
from app.models.survey import Survey, Question

router = APIRouter()

# 获取项目根目录（project目录）
# __file__ -> .../backend/app/api/teacher/survey.py
# .parent -> .../backend/app/api/teacher
# .parent.parent -> .../backend/app/api
# 问卷上传的 Word 保存目录：backend/app/api/static/questionnaire_word
API_STATIC_DIR = Path(__file__).resolve().parent.parent  # backend/app/api
SURVEY_WORD_UPLOAD_DIR = API_STATIC_DIR / "static" / "questionnaire_word"

# 模型定义
class SurveyCreate(BaseModel):
    title: str
    description: str | None = None
    questions: List[Dict[str, Any]]

class SaveSurveyRequest(BaseModel):
    file_id: Optional[str] = None
    filename: Optional[str] = None
    title: str
    description: Optional[str] = None
    questions: List[Dict[str, Any]]

class SurveyInfo(BaseModel):
    id: str
    title: str
    status: str
    responses: int
    total: int

class SurveyResults(BaseModel):
    survey_id: str
    title: str
    total_responses: int
    results: Dict[str, Any]


class PublishSurveyRequest(BaseModel):
    """发布问卷请求：选择班级与发布类型"""
    class_ids: List[str] = Field(..., min_length=1, description="发布的班级ID列表，至少选一个")
    release_type: Literal["in_class", "homework", "practice", "ability_test"] = Field(
        default="in_class",
        description="发布类型：in_class=课堂检测, homework=课后作业, practice=自主练习, ability_test=测试能力（基于大纲生成的问卷仅能发布到此）"
    )
    start_time: Optional[datetime] = Field(None, description="开始时间（可选）")
    end_time: Optional[datetime] = Field(None, description="结束时间（可选）")

@router.get("", response_model=List[Dict[str, Any]])
async def get_surveys(db: Session = Depends(get_db)):
    """
    获取教师创建的所有问卷（优化版 - 使用JOIN减少查询次数）
    """
    try:
        # 使用LEFT JOIN一次性获取所有数据，避免N+1查询问题
        from sqlalchemy import func
        
        query_result = db.query(
            Survey,
            func.count(Question.id).label('question_count')
        ).outerjoin(
            Question, Survey.id == Question.survey_id
        ).group_by(
            Survey.id
        ).order_by(
            Survey.created_at.desc()
        ).all()
        
        result = []
        for survey, question_count in query_result:
            result.append({
                "id": str(survey.id),
                "title": survey.title,
                "description": survey.description,
                "questionCount": question_count or 0,
                "status": survey.status,
                "releaseType": getattr(survey, "release_type", None) or "in_class",
                "targetClassIds": getattr(survey, "target_class_ids", None) or [],
                "createdAt": survey.created_at.strftime('%Y-%m-%d'),
                "publishedAt": survey.published_at.strftime('%Y-%m-%d') if survey.published_at else None,
                "generationMethod": getattr(survey, "generation_method", None) or "manual",
            })
        
        return result
    except Exception as e:
        print(f"获取问卷列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=Dict[str, Any])
async def create_survey(survey_data: SaveSurveyRequest, db: Session = Depends(get_db)):
    """
    创建新问卷（从Word解析后保存）
    """
    try:
        print(f"=" * 70)
        print(f"📝 开始保存问卷")
        print(f"标题: {survey_data.title}")
        print(f"描述: {survey_data.description}")
        print(f"题目数量: {len(survey_data.questions)}")
        print(f"=" * 70)
        
        # 检查问卷名称是否重复
        existing_survey = db.query(Survey).filter(
            Survey.title == survey_data.title,
            Survey.teacher_id == "00000000-0000-0000-0000-000000000001"
        ).first()
        if existing_survey:
            raise HTTPException(status_code=400, detail=f"问卷名称 '{survey_data.title}' 已存在，请使用其他名称")
        
        # 创建问卷记录
        new_survey = Survey(
            title=survey_data.title,
            description=survey_data.description,
            teacher_id="00000000-0000-0000-0000-000000000001",  # TODO: 从token获取真实teacher_id
            course_id=None,  # 可选字段
            class_id=None,   # 可选字段
            generation_method="word_upload",
            status="draft",
            total_score=sum(q.get('score', 0) for q in survey_data.questions)
        )
        
        db.add(new_survey)
        db.flush()
        
        print(f"✅ 问卷记录已创建，ID: {new_survey.id}")
        
        # 创建题目记录
        for index, q in enumerate(survey_data.questions):
            print(f"添加题目 {index + 1}: {q.get('question', '')[:50]}...")
            print(f"  类型: {q.get('type')}, 分数: {q.get('score')}, 答案: {q.get('answer')}")
            
            question = Question(
                survey_id=new_survey.id,
                question_type=q.get('type', 'single_choice'),
                question_text=q.get('question', ''),
                question_order=index + 1,
                score=q.get('score', 0),
                options=q.get('options', []),
                correct_answer=q.get('answer') or q.get('correct_answer'),  # 支持answer和correct_answer两种字段名
                answer_explanation=q.get('explanation'),  # Word 中的解析（可选）
                is_required=q.get('required', True)
            )
            db.add(question)
        
        db.commit()
        db.refresh(new_survey)
        
        print(f"✅ 问卷保存成功，共 {len(survey_data.questions)} 道题")
        print(f"=" * 70)
        
        return {
            "success": True,
            "survey_id": str(new_survey.id),
            "message": "问卷保存成功"
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ 保存问卷失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"保存问卷失败: {str(e)}")

@router.put("/{survey_id}/publish")
async def publish_survey(
    survey_id: str,
    body: PublishSurveyRequest,
    db: Session = Depends(get_db),
):
    """
    发布问卷：选择发布的班级和发布类型（课堂检测/课后作业/自主练习/测试能力）。
    发布后，对应班级的学生将在问卷检测的对应类型页面看到该问卷。
    
    时间控制规则：
    - 开始时间之前：学生只能看到倒计时
    - 开始与结束时间之间：学生可以答题
    - 结束时间之后：显示已结束
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 基于大纲生成的问卷只能发布到「测试能力」
        generation_method = getattr(survey, "generation_method", None)
        if generation_method == "knowledge_outline" and body.release_type != "ability_test":
            raise HTTPException(
                status_code=400,
                detail="基于大纲生成的问卷只能发布到「测试能力」，学生将在问卷测验的「测试能力」中看到。"
            )
        
        # 非基于大纲生成的问卷不能发布到「测试能力」
        if generation_method != "knowledge_outline" and body.release_type == "ability_test":
            raise HTTPException(
                status_code=400,
                detail="只有基于大纲生成的问卷才能发布到「测试能力」。"
            )
        
        # 验证时间设置
        if body.start_time and body.end_time:
            if body.start_time >= body.end_time:
                raise HTTPException(status_code=400, detail="开始时间必须早于结束时间")
        
        survey.status = "published"
        survey.published_at = datetime.now()
        survey.release_type = body.release_type
        survey.target_class_ids = body.class_ids
        survey.start_time = body.start_time
        survey.end_time = body.end_time
        db.commit()
        return {"success": True, "message": "问卷发布成功"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{survey_id}/unpublish")
async def unpublish_survey(survey_id: str, db: Session = Depends(get_db)):
    """
    取消发布问卷
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        survey.status = "draft"
        survey.published_at = None
        db.commit()
        
        return {"success": True, "message": "已取消发布"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{survey_id}", response_model=Dict[str, Any])
async def get_survey_detail(survey_id: str, db: Session = Depends(get_db)):
    """
    获取问卷详情
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 获取所有题目
        questions = db.query(Question).filter(
            Question.survey_id == survey_id
        ).order_by(Question.question_order).all()
        
        questions_data = []
        for q in questions:
            questions_data.append({
                "id": str(q.id),
                "questionType": q.question_type,
                "questionText": q.question_text,
                "questionOrder": q.question_order,
                "score": float(q.score) if q.score else 0,
                "difficulty": q.difficulty,
                "options": q.options,
                "correctAnswer": q.correct_answer,
                "answerExplanation": q.answer_explanation,
                "isRequired": q.is_required,
                "referenceFiles": q.reference_files,
                "minWordCount": q.min_word_count,
                "gradingCriteria": q.grading_criteria
            })
        
        return {
            "id": str(survey.id),
            "title": survey.title,
            "description": survey.description,
            "status": survey.status,
            "totalScore": survey.total_score,
            "releaseType": getattr(survey, "release_type", None) or "in_class",
            "targetClassIds": getattr(survey, "target_class_ids", None) or [],
            "questions": questions_data,
            "createdAt": survey.created_at.isoformat(),
            "publishedAt": survey.published_at.isoformat() if survey.published_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取问卷详情失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{survey_id}")
async def update_survey(survey_id: str, survey_data: SaveSurveyRequest, db: Session = Depends(get_db)):
    """
    更新问卷内容
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 更新问卷基本信息
        survey.title = survey_data.title
        survey.description = survey_data.description
        survey.total_score = sum(q.get('score', 0) for q in survey_data.questions)
        
        # 删除旧题目
        db.query(Question).filter(Question.survey_id == survey_id).delete()
        
        # 添加新题目
        for index, q in enumerate(survey_data.questions):
            question = Question(
                survey_id=survey.id,
                question_type=q.get('questionType', 'single_choice'),
                question_text=q.get('questionText', ''),
                question_order=q.get('questionOrder', index + 1),
                score=q.get('score', 0),
                options=q.get('options', []),
                correct_answer=q.get('correctAnswer'),
                answer_explanation=q.get('answerExplanation'),
                is_required=True,
                reference_files=q.get('referenceFiles') if q.get('questionType') == 'essay' else None,
                min_word_count=q.get('minWordCount') if q.get('questionType') == 'essay' else None,
                grading_criteria=q.get('gradingCriteria') if q.get('questionType') == 'essay' else None,
            )
            db.add(question)
        
        db.commit()
        
        return {
            "success": True,
            "message": "问卷更新成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"更新问卷失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{survey_id}")
async def delete_survey(survey_id: str, db: Session = Depends(get_db)):
    """
    删除问卷
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        db.delete(survey)
        db.commit()
        
        return {"success": True, "message": "问卷删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual", response_model=Dict[str, Any])
async def create_manual_survey(survey_data: SaveSurveyRequest, db: Session = Depends(get_db)):
    """
    手动创建问卷（不经过Word解析）
    """
    try:
        print(f"=" * 70)
        print(f"📝 开始创建手动问卷")
        print(f"标题: {survey_data.title}")
        print(f"描述: {survey_data.description}")
        print(f"题目数量: {len(survey_data.questions)}")
        print(f"=" * 70)
        
        # 检查问卷名称是否重复
        existing_survey = db.query(Survey).filter(
            Survey.title == survey_data.title,
            Survey.teacher_id == "00000000-0000-0000-0000-000000000001"
        ).first()
        if existing_survey:
            raise HTTPException(status_code=400, detail=f"问卷名称 '{survey_data.title}' 已存在，请使用其他名称")
        
        # 创建问卷记录
        new_survey = Survey(
            title=survey_data.title,
            description=survey_data.description,
            teacher_id="00000000-0000-0000-0000-000000000001",  # TODO: 从token获取真实teacher_id
            course_id=None,
            class_id=None,
            generation_method="manual",
            status="draft",
            total_score=sum(q.get('score', 0) for q in survey_data.questions)
        )
        
        db.add(new_survey)
        db.flush()
        
        print(f"✅ 问卷记录已创建，ID: {new_survey.id}")
        
        # 创建题目记录
        for index, q in enumerate(survey_data.questions):
            print(f"添加题目 {index + 1}: {q.get('questionText', '')[:50]}...")
            print(f"  类型: {q.get('questionType')}, 分数: {q.get('score')}, 答案: {q.get('correctAnswer')}")
            
            question = Question(
                survey_id=new_survey.id,
                question_type=q.get('questionType', 'single_choice'),
                question_text=q.get('questionText', ''),
                question_order=q.get('questionOrder', index + 1),
                score=q.get('score', 0),
                options=q.get('options', []),
                correct_answer=q.get('correctAnswer'),
                answer_explanation=q.get('answerExplanation'),
                is_required=True,
                # 问答题专用字段
                reference_files=q.get('referenceFiles') if q.get('questionType') == 'essay' else None,
                min_word_count=q.get('minWordCount') if q.get('questionType') == 'essay' else None,
                grading_criteria=q.get('gradingCriteria') if q.get('questionType') == 'essay' else None,
            )
            db.add(question)
        
        db.commit()
        db.refresh(new_survey)
        
        print(f"✅ 手动问卷保存成功，共 {len(survey_data.questions)} 道题")
        print(f"=" * 70)
        
        return {
            "success": True,
            "id": str(new_survey.id),
            "survey_id": str(new_survey.id),
            "message": "问卷创建成功"
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ 创建手动问卷失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建问卷失败: {str(e)}")


@router.post("/upload")
async def upload_reference_file(file: UploadFile = File(...)):
    """
    上传参考材料文件（用于问答题）
    """
    try:
        # 创建上传目录 - 统一到 backend/app/api/static/survey_references
        upload_dir = API_STATIC_DIR / "static" / "survey_references"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成唯一文件名
        file_ext = os.path.splitext(file.filename)[1]
        file_id = str(uuid.uuid4())
        filename = f"{file_id}{file_ext}"
        file_path = upload_dir / filename
        
        # 保存文件
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 返回文件URL
        file_url = f"/static/survey_references/{filename}"
        
        return {
            "success": True,
            "url": file_url,
            "data": {
                "url": file_url,
                "filename": file.filename,
                "size": len(content)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

@router.get("/{survey_id}/results")
async def get_survey_results(survey_id: str, db: Session = Depends(get_db)):
    """
    获取问卷统计结果
    """
    try:
        from app.models.survey import SurveyResponse, Answer
        
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 获取所有提交记录
        responses = db.query(SurveyResponse).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.status == 'completed'
        ).all()
        
        # 获取所有题目
        questions = db.query(Question).filter(
            Question.survey_id == survey_id
        ).order_by(Question.question_order).all()
        
        # 统计数据
        total_responses = len(responses)
        avg_score = 0
        pass_count = 0
        
        if total_responses > 0:
            total_scores = sum(r.total_score or 0 for r in responses)
            avg_score = total_scores / total_responses
            pass_count = sum(1 for r in responses if r.is_passed)
        
        # 统计每道题的答题情况
        question_stats = []
        for q in questions:
            answers = db.query(Answer).join(SurveyResponse).filter(
                SurveyResponse.survey_id == survey_id,
                Answer.question_id == q.id
            ).all()
            
            # 对于选择题，统计各选项的选择次数
            option_stats = {}
            correct_count = 0
            
            if q.question_type in ['single_choice', 'multiple_choice']:
                for answer in answers:
                    if answer.student_answer:
                        answer_value = answer.student_answer
                        if isinstance(answer_value, list):
                            for opt in answer_value:
                                option_stats[opt] = option_stats.get(opt, 0) + 1
                        else:
                            option_stats[answer_value] = option_stats.get(answer_value, 0) + 1
                    
                    if answer.is_correct:
                        correct_count += 1
            
            question_stats.append({
                "questionId": str(q.id),
                "questionText": q.question_text,
                "questionType": q.question_type,
                "totalAnswers": len(answers),
                "correctCount": correct_count,
                "correctRate": (correct_count / len(answers) * 100) if answers else 0,
                "optionStats": option_stats
            })
        
        return {
            "surveyId": str(survey.id),
            "title": survey.title,
            "totalResponses": total_responses,
            "avgScore": round(avg_score, 2),
            "passCount": pass_count,
            "passRate": round((pass_count / total_responses * 100), 2) if total_responses > 0 else 0,
            "questionStats": question_stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取统计结果失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/upload-word")
async def upload_word_document(file: UploadFile = File(...)):
    """
    上传并解析Word文档
    
    接收Word文档，自动解析题目，返回解析结果
    """
    save_path = None
    try:
        # 验证文件类型
        if not file.filename.endswith(('.docx', '.doc')):
            raise HTTPException(
                status_code=400, 
                detail="仅支持Word文档格式 (.docx, .doc)"
            )
        
        # 保存到 backend/app/api/static/questionnaire_word
        SURVEY_WORD_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        save_path = SURVEY_WORD_UPLOAD_DIR / f"{file_id}{file_ext}"
        
        # 保存上传的文件
        with open(str(save_path), "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 解析Word文档
        try:
            questions = doc_parser.parse_word(str(save_path))
            validation = doc_parser.validate_questions(questions)
            
            # 准备文档内容（所有问题的组合）
            doc_content = "\n".join([
                f"问题{i+1}: {q['question']}\n" + 
                "\n".join([f"{opt['label']}. {opt['text']}" for opt in q.get('options', [])])
                for i, q in enumerate(questions)
            ])
            
            # 检查是否存在重复文档
            duplicate_doc = None
            if validation['is_valid']:
                try:
                    vector_db = get_vector_db()
                    duplicate_doc = vector_db.check_duplicate(doc_content)
                except Exception as ve:
                    print(f"检查重复文档警告: {ve}")
            
            # 如果找到重复文档，返回重复信息（不保存到向量数据库）
            if duplicate_doc:
                return {
                    "success": True,
                    "file_id": file_id,
                    "filename": file.filename,
                    "questions": questions,
                    "validation": validation,
                    "is_duplicate": True,
                    "duplicate_info": {
                        "file_id": duplicate_doc['metadata'].get('file_id'),
                        "filename": duplicate_doc['metadata'].get('filename'),
                        "upload_time": duplicate_doc['metadata'].get('upload_time'),
                        "question_count": duplicate_doc['metadata'].get('question_count'),
                        "similarity": duplicate_doc['similarity']
                    },
                    "message": "检测到数据库中已有相同内容的文件",
                    "temp_file_path": save_path  # 临时文件路径，用于后续处理
                }
            
            # 如果解析成功且非重复，将文档内容存入向量数据库
            if validation['is_valid']:
                try:
                    vector_db = get_vector_db()
                    
                    # 存储到向量数据库
                    metadata = {
                        "file_id": file_id,
                        "filename": file.filename,
                        "upload_time": datetime.now().isoformat(),
                        "question_count": len(questions)
                    }
                    
                    vector_db.add_document(
                        doc_id=file_id,
                        content=doc_content,
                        metadata=metadata
                    )
                    
                except Exception as ve:
                    print(f"向量数据库存储警告: {ve}")
                    # 即使向量数据库失败，也继续返回解析结果
            
            # 返回解析结果
            return {
                "success": True,
                "file_id": file_id,
                "filename": file.filename,
                "questions": questions,
                "validation": validation,
                "is_duplicate": False,
                "message": "文档解析成功" if validation['is_valid'] else "文档解析完成，但存在问题"
            }
            
        except Exception as parse_error:
            # 删除临时文件
            if save_path and os.path.exists(save_path):
                os.remove(save_path)
                print(f"删除临时文件: {save_path}")
            raise HTTPException(
                status_code=400, 
                detail=f"文档解析失败: {str(parse_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        # 如果发生任何其他错误，确保删除临时文件
        if save_path and os.path.exists(save_path):
            try:
                os.remove(save_path)
                print(f"错误处理：删除临时文件: {save_path}")
            except:
                pass
        raise HTTPException(
            status_code=500, 
            detail=f"文件上传失败: {str(e)}"
        )


@router.get("/search-similar")
async def search_similar_questions(query: str, limit: int = 5):
    """
    搜索相似问题（从向量数据库）
    
    Args:
        query: 查询文本
        limit: 返回结果数量
    """
    try:
        vector_db = get_vector_db()
        results = vector_db.search_similar(query, n_results=limit)
        
        return {
            "success": True,
            "query": query,
            "results": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"搜索失败: {str(e)}"
        )


@router.post("/use-database-file/{new_file_id}")
async def use_database_file(new_file_id: str):
    """
    用户选择使用数据库中已有的文件，删除新上传的临时文件
    
    Args:
        new_file_id: 新上传文件的ID（需要删除）
    """
    try:
        # 从文件系统删除新上传的临时文件（与上传目录一致：backend/app/api/static/questionnaire_word）
        deleted_file = None
        
        for ext in ['.docx', '.doc']:
            file_path = SURVEY_WORD_UPLOAD_DIR / f"{new_file_id}{ext}"
            if file_path.exists():
                file_path.unlink()
                deleted_file = str(file_path)
                print(f"已删除临时文件: {file_path}")
                break
        
        return {
            "success": True,
            "message": "已删除新上传的文件，将使用数据库中的文件",
            "deleted_file": deleted_file
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除临时文件失败: {str(e)}"
        )


@router.post("/confirm-new-file")
async def confirm_new_file(file_data: Dict[str, Any]):
    """
    用户选择使用新文件，删除数据库中的旧文件，保存新文件到向量数据库
    
    Request body:
        new_file_id: 新文件ID
        old_file_id: 旧文件ID（需要删除）
        filename: 文件名
        questions: 解析的题目列表
    """
    try:
        new_file_id = file_data.get('new_file_id')
        old_file_id = file_data.get('old_file_id')
        filename = file_data.get('filename')
        questions = file_data.get('questions', [])
        
        vector_db = get_vector_db()
        
        # 1. 从向量数据库删除旧文件
        if old_file_id:
            try:
                collection = vector_db.collection
                collection.delete(ids=[old_file_id])
                print(f"已从向量数据库删除旧文件: {old_file_id}")
            except Exception as ve:
                print(f"删除旧文件失败: {ve}")
        
        # 2. 从文件系统删除旧文件（问卷 Word 保存目录）
        if old_file_id:
            for ext in [".docx", ".doc"]:
                old_file_path = SURVEY_WORD_UPLOAD_DIR / f"{old_file_id}{ext}"
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
                    print(f"已从文件系统删除旧文件: {old_file_path}")
                    break
        
        # 3. 将新文件保存到向量数据库
        # 准备文档内容（兼容两种格式）
        doc_content_parts = []
        for i, q in enumerate(questions):
            # 兼容question和questionText两种字段名
            question_text = q.get('question') or q.get('questionText', '')
            doc_content_parts.append(f"问题{i+1}: {question_text}")
            
            # 处理选项（兼容label/text和key/value两种格式）
            options = q.get('options', [])
            for opt in options:
                opt_label = opt.get('label') or opt.get('key', '')
                opt_text = opt.get('text') or opt.get('value', '')
                if opt_label and opt_text:
                    doc_content_parts.append(f"{opt_label}. {opt_text}")
        
        doc_content = "\n".join(doc_content_parts)
        
        metadata = {
            "file_id": new_file_id,
            "filename": filename,
            "upload_time": datetime.now().isoformat(),
            "question_count": len(questions)
        }
        
        vector_db.add_document(
            doc_id=new_file_id,
            content=doc_content,
            metadata=metadata
        )
        
        return {
            "success": True,
            "message": "已使用新文件替换旧文件",
            "file_id": new_file_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"确认新文件失败: {str(e)}"
        )


@router.delete("/uploaded-file/{file_id}")
async def delete_uploaded_file(file_id: str):
    """
    删除上传的文件（从向量数据库和文件系统）
    
    Args:
        file_id: 文件ID
    """
    try:
        # 从向量数据库删除
        try:
            vector_db = get_vector_db()
            collection = vector_db.collection
            collection.delete(ids=[file_id])
            print(f"已从向量数据库删除文件: {file_id}")
        except Exception as ve:
            print(f"从向量数据库删除失败: {ve}")
        
        # 从文件系统删除（问卷 Word 保存目录）
        deleted_file = None
        
        # 查找并删除文件（支持.docx和.doc扩展名）
        for ext in ['.docx', '.doc']:
            file_path = SURVEY_WORD_UPLOAD_DIR / f"{file_id}{ext}"
            if file_path.exists():
                file_path.unlink()
                deleted_file = str(file_path)
                print(f"已从文件系统删除: {file_path}")
                break
        
        return {
            "success": True,
            "message": "文件删除成功",
            "file_id": file_id,
            "deleted_path": deleted_file
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除文件失败: {str(e)}"
        )


# ==================== 学生成绩管理 API ====================

class UpdateScoreRequest(BaseModel):
    """修改分数请求"""
    total_score: float = Field(..., description="修改后的总分")
    comment: Optional[str] = Field(None, description="教师评语")


@router.get("/{survey_id}/student-scores")
async def get_student_scores(survey_id: str, db: Session = Depends(get_db)):
    """
    获取问卷的学生成绩列表
    返回所有提交该问卷的学生及其成绩
    """
    try:
        from app.models.survey import SurveyResponse
        from app.models.user import User, Student
        
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 获取所有提交记录，包含学生信息
        responses = db.query(SurveyResponse).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.status == 'completed'
        ).all()
        
        student_scores = []
        for resp in responses:
            # 获取学生信息
            user = db.query(User).filter(User.id == resp.student_id).first()
            student = db.query(Student).filter(Student.user_id == resp.student_id).first()
            
            student_scores.append({
                "responseId": str(resp.id),
                "studentId": str(resp.student_id),
                "studentName": user.full_name if user else "未知",
                "studentNumber": student.student_number if student else "-",
                "submitTime": resp.submit_time.isoformat() if resp.submit_time else None,
                "totalScore": float(resp.total_score) if resp.total_score is not None else None,
                "percentageScore": float(resp.percentage_score) if resp.percentage_score is not None else None,
                "isPassed": resp.is_passed,
                "attemptNumber": resp.attempt_number or 1
            })
        
        # 按学号排序
        student_scores.sort(key=lambda x: x['studentNumber'] or '')
        
        return {
            "surveyId": str(survey.id),
            "surveyTitle": survey.title,
            "totalScore": float(survey.total_score) if survey.total_score else 100,
            "passScore": float(survey.total_score * 0.6) if survey.total_score else 60,  # 及格线 = 总分 * 60%
            "scorePublished": survey.score_published if hasattr(survey, 'score_published') else False,
            "totalStudents": len(student_scores),
            "students": student_scores
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取学生成绩列表失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{survey_id}/student/{student_id}/answers")
async def get_student_answers(survey_id: str, student_id: str, db: Session = Depends(get_db)):
    """
    获取某个学生的答卷详情
    包含每道题的题目、学生答案、正确答案、得分等
    """
    try:
        from app.models.survey import SurveyResponse, Answer
        from app.models.user import User, Student
        import json
        
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 获取学生信息
        user = db.query(User).filter(User.id == student_id).first()
        student = db.query(Student).filter(Student.user_id == student_id).first()
        
        # 获取学生的提交记录（取最新一次）
        response = db.query(SurveyResponse).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.student_id == student_id
        ).order_by(SurveyResponse.attempt_number.desc()).first()
        
        if not response:
            raise HTTPException(status_code=404, detail="未找到该学生的答卷")
        
        # 获取所有题目
        questions = db.query(Question).filter(
            Question.survey_id == survey_id
        ).order_by(Question.question_order).all()
        
        # 获取学生的所有答案
        answers = db.query(Answer).filter(
            Answer.response_id == response.id
        ).all()
        
        # 构建答案字典
        answer_dict = {str(a.question_id): a for a in answers}
        
        # 构建返回数据
        question_answers = []
        for q in questions:
            ans = answer_dict.get(str(q.id))
            
            # 解析 AI 评分结果
            grading_result = None
            if ans and ans.teacher_comment:
                try:
                    grading_result = json.loads(ans.teacher_comment)
                except:
                    pass
            
            question_answers.append({
                "questionId": str(q.id),
                "questionOrder": q.question_order,
                "questionText": q.question_text,
                "questionType": q.question_type,
                "options": q.options,
                "correctAnswer": q.correct_answer,
                "maxScore": float(q.score) if q.score else 0,
                "studentAnswer": ans.student_answer if ans else None,
                "isCorrect": ans.is_correct if ans else None,
                "score": float(ans.score) if ans and ans.score is not None else 0,
                "teacherComment": ans.teacher_comment if ans else None,
                "gradingResult": grading_result
            })
        
        return {
            "surveyId": str(survey.id),
            "surveyTitle": survey.title,
            "responseId": str(response.id),
            "studentId": str(student_id),
            "studentName": user.full_name if user else "未知",
            "studentNumber": student.student_number if student else "-",
            "submitTime": response.submit_time.isoformat() if response.submit_time else None,
            "totalScore": float(response.total_score) if response.total_score is not None else None,
            "percentageScore": float(response.percentage_score) if response.percentage_score is not None else None,
            "isPassed": response.is_passed,
            "surveyTotalScore": float(survey.total_score) if survey.total_score else 100,
            "questions": question_answers
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取学生答卷详情失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{survey_id}/student/{student_id}/score")
async def update_student_score(
    survey_id: str, 
    student_id: str, 
    request: UpdateScoreRequest,
    db: Session = Depends(get_db)
):
    """
    修改学生的成绩
    """
    try:
        from app.models.survey import SurveyResponse
        
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 获取学生的提交记录
        response = db.query(SurveyResponse).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.student_id == student_id
        ).order_by(SurveyResponse.attempt_number.desc()).first()
        
        if not response:
            raise HTTPException(status_code=404, detail="未找到该学生的答卷")
        
        # 更新分数
        response.total_score = request.total_score
        response.percentage_score = (request.total_score / survey.total_score * 100) if survey.total_score > 0 else 0
        response.is_passed = response.percentage_score >= 60  # 百分比得分 >= 60% 为及格
        
        db.commit()
        
        return {
            "success": True,
            "message": "分数修改成功",
            "studentId": student_id,
            "newScore": request.total_score,
            "percentageScore": response.percentage_score,
            "isPassed": response.is_passed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"修改学生分数失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{survey_id}/question/{question_id}/student/{student_id}/score")
async def update_question_score(
    survey_id: str,
    question_id: str,
    student_id: str,
    score: float,
    comment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    修改学生某道题的分数
    """
    try:
        from app.models.survey import SurveyResponse, Answer
        
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 获取学生的提交记录
        response = db.query(SurveyResponse).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.student_id == student_id
        ).order_by(SurveyResponse.attempt_number.desc()).first()
        
        if not response:
            raise HTTPException(status_code=404, detail="未找到该学生的答卷")
        
        # 获取该题的答案记录
        answer = db.query(Answer).filter(
            Answer.response_id == response.id,
            Answer.question_id == question_id
        ).first()
        
        if not answer:
            raise HTTPException(status_code=404, detail="未找到该题的答案记录")
        
        # 计算分数差值
        old_score = float(answer.score) if answer.score is not None else 0
        score_diff = score - old_score
        
        # 更新题目分数
        answer.score = score
        if comment:
            answer.teacher_comment = comment
        
        # 更新总分
        response.total_score = (response.total_score or 0) + score_diff
        response.percentage_score = (response.total_score / survey.total_score * 100) if survey.total_score > 0 else 0
        response.is_passed = response.percentage_score >= 60  # 百分比得分 >= 60% 为及格
        
        db.commit()
        
        return {
            "success": True,
            "message": "题目分数修改成功",
            "questionId": question_id,
            "newScore": score,
            "totalScore": response.total_score,
            "percentageScore": response.percentage_score,
            "isPassed": response.is_passed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"修改题目分数失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{survey_id}/publish-scores")
async def publish_scores(survey_id: str, db: Session = Depends(get_db)):
    """
    发布成绩
    发布后学生可以查看自己的成绩
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 设置成绩已发布标志
        survey.score_published = True
        survey.score_published_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "success": True,
            "message": "成绩发布成功",
            "surveyId": survey_id,
            "publishedAt": survey.score_published_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"发布成绩失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{survey_id}/unpublish-scores")
async def unpublish_scores(survey_id: str, db: Session = Depends(get_db)):
    """
    取消发布成绩
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        # 取消成绩发布标志
        survey.score_published = False
        survey.score_published_at = None
        
        db.commit()
        
        return {
            "success": True,
            "message": "已取消发布成绩",
            "surveyId": survey_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"取消发布成绩失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
