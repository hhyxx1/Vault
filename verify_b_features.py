
import os
import sys
from pathlib import Path

# 将 backend 目录添加到 sys.path
backend_path = Path(__file__).parent / "backend"
sys.path.append(str(backend_path))

try:
    from app.services.document_parser import DocumentParser
    from app.services.qa_service import QAService
except ImportError as e:
    print(f"导入失败: {e}")
    # 尝试另一种路径
    sys.path.append(str(Path(__file__).parent))
    from app.services.document_parser import DocumentParser
    from app.services.qa_service import QAService

def test_document_parsing():
    print("\n=== 测试文档解析功能 ===")
    parser = DocumentParser()
    
    # 1. 测试纯文本解析
    test_txt = Path("test_sample.txt")
    test_txt.write_text("这是一个测试文本文件。\n包含多行内容。\n用于验证基础解析功能。", encoding="utf-8")
    
    txt_result = parser.parse_file(test_txt)
    print(f"文本解析结果: {txt_result}")
    
    # 2. 测试代码解析
    test_py = Path("test_sample.py")
    test_py.write_text("def hello():\n    print('hello world')\n\n# 测试注释", encoding="utf-8")
    
    py_result = parser.parse_file(test_py)
    print(f"代码解析结果: {py_result}")
    
    # 清理临时文件
    test_txt.unlink()
    test_py.unlink()

def test_smart_splitting():
    print("\n=== 测试智能分块功能 ===")
    # 模拟 QAService
    qa_service = QAService()
    
    # 构造一个长文本
    long_text = "这是第一段非常长的文本。" * 50 + "\n这是第二段非常长的文本。" * 50
    raw_chunks = [{"content": long_text, "metadata": {"source": "test.txt"}}]
    
    # 测试分块
    split_chunks = qa_service._smart_split(raw_chunks, chunk_size=200, overlap=50)
    
    print(f"原始文本长度: {len(long_text)}")
    print(f"分块后数量: {len(split_chunks)}")
    if split_chunks:
        print(f"第一个分块长度: {len(split_chunks[0]['content'])}")
        print(f"第一个分块预览: {split_chunks[0]['content'][:50]}...")
        if len(split_chunks) > 1:
            print(f"第二个分块预览: {split_chunks[1]['content'][:50]}...")

def test_docling_integration():
    print("\n=== 测试 Docling PDF 解析集成 ===")
    parser = DocumentParser()
    
    # 检查 docling 是否可用
    from app.services.document_parser import HAS_DOCLING
    print(f"Docling 是否已安装并加载: {HAS_DOCLING}")
    
    # 由于没有真实的 PDF，我们只测试逻辑路径
    # 如果 HAS_DOCLING 为 True，说明集成成功

if __name__ == "__main__":
    try:
        test_document_parsing()
        test_smart_splitting()
        test_docling_integration()
        print("\n✅ 工作流 B 核心功能验证完成！")
    except Exception as e:
        print(f"\n❌ 验证过程中出错: {e}")
        import traceback
        traceback.print_exc()
