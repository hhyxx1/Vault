import os
import logging
import uuid
import json
import hashlib
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime
from openai import OpenAI
from sqlalchemy.orm import Session

from app.models.qa import QASession, QARecord, QAShare
from app.services.document_parser import DocumentParser
from app.services.vector_db_service import get_vector_db
from app.services.skill_loader import SkillLoader
from app.services.workflow_service import workflow_service

class QAService:
    """
    智能问答服务 - 核心业务逻辑类
    负责处理用户上传的文件（解析、切分、入库）以及与 AI 模型的交互。
    现在集成了工作流引擎，支持动态 Skill 调用。
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # 初始化文档处理器（用于提取文件内容，支持 PDF/Word/PPT/TXT 等格式）
        from app.services.document_processor import document_processor
        self.doc_processor = document_processor
        # 初始化向量数据库服务（用于存储和搜索知识）
        self.vector_db = get_vector_db()
        # 初始化技能加载器（用于获取 AI 助手的行为模板）
        self.skill_loader = SkillLoader()
        self.skill_loader.load_skills()
        
        # AI 客户端配置
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        
        # 工作流服务
        self.workflow = workflow_service

    async def process_file_upload(self, file_path: Path, student_id: str) -> Dict[str, Any]:
        """
        处理用户上传的文件全流程：解析 -> 智能分块 -> 存入QA专属知识库
        
        支持格式：PDF、Word(.doc/.docx)、PPT(.ppt/.pptx)、文本文件(.txt/.md)、代码文件等
        
        Args:
            file_path: 上传文件的存储路径
            student_id: 上传者的 ID
            
        Returns:
            Dict: 包含处理结果（成功/失败、块数量等）
        """
        try:
            # 1. 获取文件扩展名
            file_ext = file_path.suffix.lower()
            self.logger.info(f"正在解析文件: {file_path}，类型: {file_ext}")
            
            # 2. 根据文件类型提取文本内容
            if file_ext in ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md']:
                # 使用文档处理器提取文本
                result = self.doc_processor.process_document(
                    str(file_path), 
                    file_ext,
                    {"filename": file_path.name, "student_id": student_id}
                )
                chunks = result['chunks']
                processed_chunks = [
                    {"content": chunk['text'], "metadata": chunk.get('metadata', {})}
                    for chunk in chunks
                ]
            else:
                # 代码文件或其他文本文件，直接读取
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                except UnicodeDecodeError:
                    with open(file_path, 'r', encoding='gbk') as f:
                        content = f.read()
                
                # 对内容进行智能切分
                raw_chunks = [{"content": content, "metadata": {"filename": file_path.name}}]
                processed_chunks = self._smart_split(raw_chunks)
            
            # 3. 将切分好的文本块存入QA专属知识库
            success_count = 0
            total_chunks = len(processed_chunks)
            for i, chunk in enumerate(processed_chunks):
                doc_id = f"qa_{student_id}_{file_path.stem}_{i}_{uuid.uuid4().hex[:8]}"
                metadata = {
                    "filename": file_path.name,
                    "student_id": student_id,
                    "chunk_index": i,
                    "total_chunks": total_chunks,
                    "upload_time": datetime.now().isoformat(),
                    **chunk.get("metadata", {})
                }
                
                # 使用QA专属知识库方法
                if self.vector_db.add_qa_document(doc_id, chunk["content"], metadata):
                    success_count += 1
            
            self.logger.info(f"文件 {file_path.name} 已存入QA知识库，共 {success_count} 个文档块")
            
            return {
                "success": True,
                "chunk_count": success_count,
                "filename": file_path.name
            }
        except Exception as e:
            self.logger.error(f"处理文件上传失败: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def _smart_split(self, raw_chunks: List[Dict], chunk_size: int = 800, overlap: int = 150) -> List[Dict]:
        """
        滑动窗口切分算法：将长文本切成小段，并保持段落间有重叠。
        
        Args:
            raw_chunks: 原始文本数据
            chunk_size: 每个分块的最大字数（默认 800 字）
            overlap: 分块之间的重叠字数（默认 150 字，防止知识点被拦腰切断）
            
        Returns:
            List[Dict]: 切分后的文本块列表
        """
        final_chunks = []
        for raw in raw_chunks:
            content = raw["content"]
            metadata = raw["metadata"]
            
            # 如果文本本身就很短，无需切分
            if len(content) <= chunk_size:
                final_chunks.append(raw)
                continue
            
            # 使用滑动窗口进行切分
            start = 0
            while start < len(content):
                end = start + chunk_size
                chunk_text = content[start:end]
                
                final_chunks.append({
                    "content": chunk_text,
                    "metadata": {**metadata, "chunk_index": len(final_chunks)}
                })
                
                # 窗口向前移动 (步长 = 块大小 - 重叠大小)
                start += (chunk_size - overlap)
                
        return final_chunks

    async def get_ai_answer(self, question: str, session_id: str, student_id: str, db: Session = None) -> Dict[str, Any]:
        """
        获取 AI 的智能回答 - 使用工作流引擎
        
        工作流程：意图识别 → 知识检索 → Skill匹配 → 回答生成
        """
        start_time = datetime.now()
        try:
            # 确保有有效的 session_id
            if not session_id:
                session_id = str(uuid.uuid4())
            
            # 如果有数据库连接，确保 session 存在
            if db:
                existing_session = db.query(QASession).filter(
                    QASession.id == session_id
                ).first()
                
                if not existing_session:
                    # 创建新会话
                    new_session = QASession(
                        id=session_id,
                        student_id=student_id,
                        title=question[:50] if question else "新对话",  # 使用问题前50字符作为标题
                        message_count=0,
                        is_active=True
                    )
                    db.add(new_session)
                    db.commit()
                    self.logger.info(f"创建新会话: {session_id}")
            
            # 使用工作流引擎处理
            result = await self.workflow.execute(
                question=question,
                session_id=session_id,
                student_id=student_id
            )
            
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # 保存问答记录到数据库
            if db and result.get("answer"):
                try:
                    qa_record = QARecord(
                        student_id=student_id,
                        session_id=session_id,
                        question=question,
                        answer=result["answer"],
                        answer_type='ai',
                        knowledge_sources=result.get("sources", []),
                        intent=result.get("intent"),
                        skill_used=result.get("skill_used"),
                        context_used={
                            "intent": result.get("intent"),
                            "skill_used": result.get("skill_used")
                        },
                        response_time=response_time
                    )
                    db.add(qa_record)
                    
                    # 更新会话的消息计数
                    session = db.query(QASession).filter(
                        QASession.id == session_id
                    ).first()
                    if session:
                        session.message_count += 1
                        session.last_message_at = datetime.now()
                    
                    db.commit()
                except Exception as db_error:
                    self.logger.warning(f"保存问答记录失败: {db_error}")
                    import traceback
                    traceback.print_exc()
                    db.rollback()

            return {
                "answer": result["answer"],
                "sources": result.get("sources", []),
                "session_id": session_id or result.get("session_id"),
                "intent": result.get("intent"),
                "skill_used": result.get("skill_used")
            }
        except Exception as e:
            self.logger.error(f"AI 生成回答失败: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            # 返回友好的错误信息而不是抛出异常
            return {
                "answer": f"抱歉，生成回答时遇到了问题：{str(e)[:100]}。请稍后再试。",
                "sources": [],
                "session_id": session_id,
                "intent": None,
                "skill_used": None
            }

    async def create_session(self, student_id: str, title: str, db: Session) -> str:
        """创建问答会话"""
        session = QASession(
            student_id=student_id,
            title=title or "新对话",
            message_count=0,
            is_active=True
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return str(session.id)
    
    async def get_student_history(self, student_id: str, db: Session, limit: int = 50) -> List[Dict]:
        """获取学生的问答历史（按会话分组）"""
        # 获取所有会话
        sessions = db.query(QASession).filter(
            QASession.student_id == student_id
        ).order_by(QASession.created_at.desc()).limit(limit).all()
        
        result = []
        for session in sessions:
            # 获取该会话的第一个问题（session_id 现在是 UUID 类型）
            first_record = db.query(QARecord).filter(
                QARecord.session_id == session.id  # 直接比较 UUID
            ).order_by(QARecord.created_at.asc()).first()
            
            result.append({
                "session_id": str(session.id),
                "title": session.title,
                "first_question": first_record.question if first_record else "未命名对话",
                "message_count": session.message_count,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat()
            })
        
        return result
    
    # ============ 对话分享功能 ============
    
    def _generate_share_code(self, session_id: str) -> str:
        """生成分享码（6位短码）"""
        hash_str = hashlib.md5(f"{session_id}{datetime.now().timestamp()}".encode()).hexdigest()
        return hash_str[:6].upper()
    
    async def create_share(self, session_id: str, student_id: str, db: Session) -> Dict[str, Any]:
        """
        创建对话分享
        
        Args:
            session_id: 会话ID
            student_id: 学生ID
            db: 数据库会话
            
        Returns:
            Dict: 包含分享码和分享链接
        """
        # 获取该会话的所有对话记录
        records = db.query(QARecord).filter(
            QARecord.session_id == session_id,
            QARecord.student_id == student_id
        ).order_by(QARecord.created_at.asc()).all()
        
        if not records:
            return {"success": False, "error": "未找到对话记录"}
        
        # 生成分享码
        share_code = self._generate_share_code(session_id)
        
        # 构建对话内容
        messages = []
        for record in records:
            messages.append({
                "role": "user",
                "content": record.question,
                "timestamp": record.created_at.isoformat()
            })
            messages.append({
                "role": "assistant",
                "content": record.answer,
                "sources": record.knowledge_sources or [],
                "timestamp": record.created_at.isoformat()
            })
        
        title = f"对话分享 - {records[0].question[:20]}..." if records else "对话分享"
        
        # 尝试保存到数据库
        try:
            share = QAShare(
                share_code=share_code,
                session_id=session_id,
                student_id=student_id,
                title=title,
                messages=messages
            )
            db.add(share)
            db.commit()
            self.logger.info(f"分享已保存到数据库: {share_code}")
        except Exception as e:
            # 如果数据库表不存在，回退到文件存储
            self.logger.warning(f"数据库保存失败，使用文件存储: {e}")
            db.rollback()
            
            share_data = {
                "share_code": share_code,
                "session_id": session_id,
                "student_id": student_id,
                "messages": messages,
                "created_at": datetime.now().isoformat(),
                "title": title
            }
            
            share_dir = Path(__file__).parent.parent.parent / "data" / "shares"
            share_dir.mkdir(parents=True, exist_ok=True)
            share_file = share_dir / f"{share_code}.json"
            
            with open(share_file, "w", encoding="utf-8") as f:
                json.dump(share_data, f, ensure_ascii=False, indent=2)
        
        # 不返回完整URL，让前端自己拼接（这样可以适应不同的部署环境）
        return {
            "success": True,
            "share_code": share_code,
            "share_url": f"/shared/{share_code}",  # 前端会拼接为完整URL
            "message_count": len(messages) // 2
        }
    
    async def get_shared_conversation(self, share_code: str, db: Session = None) -> Dict[str, Any]:
        """
        获取分享的对话内容
        
        Args:
            share_code: 分享码
            db: 数据库会话（可选）
            
        Returns:
            Dict: 对话内容
        """
        # 首先尝试从数据库获取
        if db:
            try:
                share = db.query(QAShare).filter(
                    QAShare.share_code == share_code,
                    QAShare.is_active == True
                ).first()
                
                if share:
                    # 更新查看次数
                    share.view_count = (share.view_count or 0) + 1
                    db.commit()
                    
                    return {
                        "success": True,
                        "title": share.title or "对话分享",
                        "messages": share.messages or [],
                        "created_at": share.created_at.isoformat() if share.created_at else None
                    }
            except Exception as e:
                self.logger.warning(f"从数据库获取分享失败: {e}")
        
        # 回退到文件存储
        share_dir = Path(__file__).parent.parent.parent / "data" / "shares"
        share_file = share_dir / f"{share_code}.json"
        
        if not share_file.exists():
            return {"success": False, "error": "分享链接已失效或不存在"}
        
        with open(share_file, "r", encoding="utf-8") as f:
            share_data = json.load(f)
        
        return {
            "success": True,
            "title": share_data.get("title", "对话分享"),
            "messages": share_data.get("messages", []),
            "created_at": share_data.get("created_at")
        }
    
    async def get_session_messages(self, session_id: str, student_id: str, db: Session) -> List[Dict]:
        """获取指定会话的所有消息"""
        records = db.query(QARecord).filter(
            QARecord.session_id == session_id,
            QARecord.student_id == student_id
        ).order_by(QARecord.created_at.asc()).all()
        
        messages = []
        for record in records:
            messages.append({
                "role": "user",
                "content": record.question,
                "timestamp": record.created_at.isoformat()
            })
            messages.append({
                "role": "assistant",
                "content": record.answer,
                "sources": record.knowledge_sources or [],
                "intent": record.intent,
                "skill_used": record.skill_used,
                "timestamp": record.created_at.isoformat()
            })
        
        return messages

qa_service = QAService()
