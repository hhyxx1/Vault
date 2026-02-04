from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pathlib import Path
import os
import shutil
import subprocess
import tempfile

from app.database import get_db
from app.models.user import User
from app.models.course import Course
from app.utils.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()


def _find_libreoffice() -> Optional[str]:
    """查找 LibreOffice/soffice 可执行文件（用于 PPTX 转 PDF）。支持环境变量 LIBREOFFICE_PATH。"""
    # 1. 环境变量（用户可手动指定路径）
    for env_key in ("LIBREOFFICE_PATH", "SOFFICE_PATH"):
        path = os.environ.get(env_key)
        if path and Path(path).exists():
            return path
    # 2. PATH 中的 soffice / libreoffice
    exe = shutil.which("soffice") or shutil.which("libreoffice")
    if exe:
        return exe
    # 3. Windows 常见安装路径（含带版本号的 LibreOffice 24、LibreOffice 7 等）
    if os.name == "nt":
        for base in [
            os.environ.get("ProgramFiles", "C:\\Program Files"),
            os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"),
        ]:
            base_path = Path(base)
            if not base_path.exists():
                continue
            # 先试固定名 LibreOffice
            p = base_path / "LibreOffice" / "program" / "soffice.exe"
            if p.exists():
                return str(p)
            # 再试带版本号的目录 LibreOffice 24.2.0、LibreOffice 7 等
            for sub in base_path.iterdir():
                if sub.is_dir() and sub.name.startswith("LibreOffice"):
                    soffice = sub / "program" / "soffice.exe"
                    if soffice.exists():
                        return str(soffice)
    return None


def _pptx_to_pdf(pptx_path: Path, out_dir: Path, timeout: int = 60) -> Optional[Path]:
    """使用 LibreOffice 将 PPTX 转为 PDF，返回生成的 PDF 路径，失败返回 None。"""
    exe = _find_libreoffice()
    if not exe:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [exe, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(pptx_path)],
            capture_output=True,
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        pdf_path = out_dir / (pptx_path.stem + ".pdf")
        return pdf_path if pdf_path.exists() else None
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return None


class DocumentResponse(BaseModel):
    id: str
    file_name: str
    file_path: str
    file_size: int
    file_type: str
    uploaded_at: str
    
    class Config:
        from_attributes = True

class CourseDocumentsResponse(BaseModel):
    course_id: str
    course_code: str
    course_name: str
    teacher_name: str
    documents: List[DocumentResponse]
    total_count: int

@router.get("/{course_id}/documents", response_model=CourseDocumentsResponse)
async def get_course_documents(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取课程的所有文档（学生只读）"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")
    
    # 查询课程信息
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    # 验证学生是否加入了这个课程的班级
    enrolled = db.execute(
        text("""
            SELECT COUNT(*) 
            FROM class_students cs
            INNER JOIN classes c ON cs.class_id = c.id
            WHERE cs.student_id = :student_id 
            AND c.course_id = :course_id
            AND cs.status = 'active'
            AND c.status = 'active'
        """),
        {"student_id": str(current_user.id), "course_id": str(course_id)}
    ).scalar()
    
    if not enrolled:
        raise HTTPException(status_code=403, detail="您未加入此课程的班级")
    
    # 查询课程文档（使用 raw SQL，course_documents 表无 ORM 模型）
    result = db.execute(
        text("""
            SELECT id, file_name, file_path, file_size, file_type, created_at
            FROM course_documents
            WHERE course_id = :course_id
            AND upload_status = 'completed'
            ORDER BY created_at DESC
        """),
        {"course_id": str(course_id)}
    )
    
    documents = []
    for row in result:
        documents.append(DocumentResponse(
            id=str(row[0]),
            file_name=row[1],
            file_path=row[2],
            file_size=row[3] or 0,
            file_type=row[4] or "",
            uploaded_at=row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else ""
        ))
    
    # 获取教师姓名
    teacher = db.query(User).filter(User.id == course.teacher_id).first()
    teacher_name = teacher.full_name if teacher and teacher.full_name else teacher.username if teacher else "未知教师"
    
    return CourseDocumentsResponse(
        course_id=str(course.id),
        course_code=course.course_code,
        course_name=course.course_name,
        teacher_name=teacher_name,
        documents=documents,
        total_count=len(documents)
    )

@router.get("/{course_id}/documents/{document_id}/download")
async def download_document(
    course_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """下载课程文档"""
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="只有学生可以下载文档")
    
    # 验证学生是否加入了这个课程的班级
    enrolled = db.execute(
        text("""
            SELECT COUNT(*) 
            FROM class_students cs
            INNER JOIN classes c ON cs.class_id = c.id
            WHERE cs.student_id = :student_id 
            AND c.course_id = :course_id
            AND cs.status = 'active'
            AND c.status = 'active'
        """),
        {"student_id": str(current_user.id), "course_id": str(course_id)}
    ).scalar()
    
    if not enrolled:
        raise HTTPException(status_code=403, detail="您未加入此课程的班级")
    
    # 查询文档
    doc_row = db.execute(
        text("""
            SELECT file_name, file_path
            FROM course_documents
            WHERE id = :document_id
            AND course_id = :course_id
            AND upload_status = 'completed'
        """),
        {"document_id": str(document_id), "course_id": str(course_id)}
    ).fetchone()
    
    if not doc_row:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    file_name, file_path = doc_row[0], doc_row[1]
    
    # 文件路径可能是绝对路径或相对路径
    file_full_path = Path(file_path)
    if not file_full_path.is_absolute():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        file_full_path = backend_dir / "app" / file_path
    
    if not file_full_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=str(file_full_path),
        filename=file_name,
        media_type='application/octet-stream'
    )


@router.get("/{course_id}/documents/{document_id}/preview-pdf")
async def preview_document_as_pdf(
    course_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    以 PDF 形式预览文档（完整页数）。
    - 若为 PDF，直接返回原文件。
    - 若为 PPTX/PPT，尝试用 LibreOffice 转为 PDF 后返回（需服务器安装 LibreOffice）。
    - 其他格式或转换不可用时返回 503。
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以访问此接口")

    enrolled = db.execute(
        text("""
            SELECT COUNT(*) FROM class_students cs
            INNER JOIN classes c ON cs.class_id = c.id
            WHERE cs.student_id = :student_id AND c.course_id = :course_id
            AND cs.status = 'active' AND c.status = 'active'
        """),
        {"student_id": str(current_user.id), "course_id": str(course_id)},
    ).scalar()
    if not enrolled:
        raise HTTPException(status_code=403, detail="您未加入此课程的班级")

    doc_row = db.execute(
        text("""
            SELECT file_name, file_path FROM course_documents
            WHERE id = :document_id AND course_id = :course_id AND upload_status = 'completed'
        """),
        {"document_id": str(document_id), "course_id": str(course_id)},
    ).fetchone()
    if not doc_row:
        raise HTTPException(status_code=404, detail="文档不存在")

    file_name, file_path = doc_row[0], doc_row[1]
    backend_dir = Path(__file__).resolve().parent.parent.parent
    file_full_path = Path(file_path) if Path(file_path).is_absolute() else backend_dir / "app" / file_path
    if not file_full_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    lower_name = file_name.lower()
    if lower_name.endswith(".pdf"):
        return FileResponse(
            path=str(file_full_path),
            filename=file_name,
            media_type="application/pdf",
        )

    if lower_name.endswith(".pptx") or lower_name.endswith(".ppt"):
        tmp_dir = Path(tempfile.mkdtemp())
        try:
            pdf_path = _pptx_to_pdf(file_full_path, tmp_dir)
            if pdf_path and pdf_path.exists():
                return FileResponse(
                    path=str(pdf_path),
                    filename=file_full_path.stem + ".pdf",
                    media_type="application/pdf",
                )
        finally:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass
        raise HTTPException(
            status_code=503,
            detail="PPT 转 PDF 需要服务器安装 LibreOffice；请下载到本地查看完整页数。",
        )

    raise HTTPException(status_code=404, detail="该格式不支持 PDF 预览")
