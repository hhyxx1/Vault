from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.services.document_parser import doc_parser
from app.services.vector_db_service import get_vector_db
from app.database import get_db
from app.models.survey import Survey, Question

router = APIRouter()

# 模型定义
class SurveyCreate(BaseModel):
    title: str
    description: str | None = None
    questions: List[Dict[str, Any]]

class SaveSurveyRequest(BaseModel):
    file_id: str
    filename: str
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

@router.get("", response_model=List[Dict[str, Any]])
async def get_surveys(db: Session = Depends(get_db)):
    """
    获取教师创建的所有问卷
    """
    try:
        # 从数据库获取问卷列表
        surveys = db.query(Survey).order_by(Survey.created_at.desc()).all()
        
        result = []
        for survey in surveys:
            # 获取题目数量
            question_count = db.query(func.count(Question.id)).filter(
                Question.survey_id == survey.id
            ).scalar()
            
            result.append({
                "id": str(survey.id),
                "title": survey.title,
                "description": survey.description,
                "questionCount": question_count,
                "status": survey.status,
                "createdAt": survey.created_at.strftime('%Y-%m-%d'),
                "publishedAt": survey.published_at.strftime('%Y-%m-%d') if survey.published_at else None
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
async def publish_survey(survey_id: str, db: Session = Depends(get_db)):
    """
    发布问卷
    """
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="问卷不存在")
        
        survey.status = "published"
        survey.published_at = datetime.now()
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

@router.get("/{survey_id}/results", response_model=SurveyResults)
async def get_survey_results(survey_id: str):
    """
    获取问卷统计结果
    """
    # TODO: 从数据库统计结果
    return SurveyResults(
        survey_id=survey_id,
        title="课程反馈调查",
        total_responses=45,
        results={
            "q1": {
                "非常满意": 20,
                "满意": 15,
                "一般": 8,
                "不满意": 2
            }
        }
    )


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
        
        # 创建临时文件夹
        upload_dir = os.path.join(os.getcwd(), "uploads", "documents")
        os.makedirs(upload_dir, exist_ok=True)
        
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        save_path = os.path.join(upload_dir, f"{file_id}{file_ext}")
        
        # 保存上传的文件
        with open(save_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 解析Word文档
        try:
            questions = doc_parser.parse_word(save_path)
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
        # 从文件系统删除新上传的临时文件
        upload_dir = os.path.join(os.getcwd(), "uploads", "documents")
        deleted_file = None
        
        for ext in ['.docx', '.doc']:
            file_path = os.path.join(upload_dir, f"{new_file_id}{ext}")
            if os.path.exists(file_path):
                os.remove(file_path)
                deleted_file = file_path
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
        
        # 2. 从文件系统删除旧文件
        if old_file_id:
            upload_dir = os.path.join(os.getcwd(), "uploads", "documents")
            for ext in ['.docx', '.doc']:
                old_file_path = os.path.join(upload_dir, f"{old_file_id}{ext}")
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
                    print(f"已从文件系统删除旧文件: {old_file_path}")
                    break
        
        # 3. 将新文件保存到向量数据库
        doc_content = "\n".join([
            f"问题{i+1}: {q['question']}\n" + 
            "\n".join([f"{opt['label']}. {opt['text']}" for opt in q.get('options', [])])
            for i, q in enumerate(questions)
        ])
        
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
        
        # 从文件系统删除
        upload_dir = os.path.join(os.getcwd(), "uploads", "documents")
        deleted_file = None
        
        # 查找并删除文件（支持.docx和.doc扩展名）
        for ext in ['.docx', '.doc']:
            file_path = os.path.join(upload_dir, f"{file_id}{ext}")
            if os.path.exists(file_path):
                os.remove(file_path)
                deleted_file = file_path
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
