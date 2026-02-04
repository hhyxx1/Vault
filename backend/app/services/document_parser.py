import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import json
import logging

# 引入 Docling
try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False
    print("⚠️ Warning: docling not installed. Falling back to basic PDF parsing.")

class DocumentParser:
    """
    文档解析服务 - 核心类
    负责将各种格式的文件（PDF, 代码, 文本）转换为大模型易于理解的 Markdown 结构。
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # 如果安装了 docling，则初始化其转换器
        if HAS_DOCLING:
            self.converter = DocumentConverter()
        else:
            self.converter = None

    def parse_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        统一入口：根据文件后缀名调用不同的解析方法
        
        Args:
            file_path: 文件的绝对路径 (Path 对象)
            
        Returns:
            List[Dict]: 结构化数据列表，每个字典包含 content(文本内容) 和 metadata(元数据)
        """
        suffix = file_path.suffix.lower()
        
        if suffix == '.pdf':
            return self._parse_pdf_with_docling(file_path)
        elif suffix in ['.md', '.txt']:
            return self._parse_text_file(file_path)
        elif suffix in ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.go']:
            return self._parse_code_file(file_path)
        else:
            # 对于未知格式，默认尝试作为纯文本读取
            return self._parse_text_file(file_path)

    def _parse_pdf_with_docling(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        使用 IBM Docling 引擎深度解析 PDF
        相比普通解析，它能更好地处理表格、公式和文档层级。
        """
        if not HAS_DOCLING:
            # 如果环境中没有 docling 库，返回错误提示
            return [{"content": f"PDF 解析失败 (未安装 docling): {file_path.name}", "metadata": {"source": file_path.name, "page": 1}}]

        try:
            # 执行文档转换
            result = self.converter.convert(str(file_path))
            # 将解析后的内部文档对象导出为标准的 Markdown 文本
            markdown_content = result.document.export_to_markdown()
            
            # 返回解析结果
            return [{
                "content": markdown_content,
                "metadata": {
                    "source": file_path.name,
                    "type": "pdf",
                    "total_pages": len(result.document.pages) if hasattr(result.document, 'pages') else 1
                }
            }]
        except Exception as e:
            self.logger.error(f"Docling 解析 PDF 失败: {e}")
            return [{"content": f"解析出错: {str(e)}", "metadata": {"source": file_path.name, "error": True}}]

    def _parse_text_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        解析纯文本或 Markdown 文件
        直接读取文件内容并保留原样。
        """
        try:
            content = file_path.read_text(encoding='utf-8')
            return [{
                "content": content,
                "metadata": {"source": file_path.name, "type": "text"}
            }]
        except Exception as e:
            return [{"content": f"读取失败: {str(e)}", "metadata": {"source": file_path.name, "error": True}}]

    def _parse_code_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        解析代码文件
        会自动为内容添加 Markdown 代码块语法（如 ```python ... ```），方便大模型识别。
        """
        try:
            content = file_path.read_text(encoding='utf-8')
            lang = file_path.suffix[1:] # 提取后缀作为语言标识（如 py, js）
            formatted_content = f"```{lang}\n{content}\n```"
            return [{
                "content": formatted_content,
                "metadata": {"source": file_path.name, "type": "code", "language": lang}
            }]
        except Exception as e:
            return [{"content": f"代码读取失败: {str(e)}", "metadata": {"source": file_path.name, "error": True}}]

# 创建单例对象，方便其他模块直接导入使用
doc_parser = DocumentParser()
