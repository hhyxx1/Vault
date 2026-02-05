"""
文件上传增强功能

支持的功能：
1. 多格式文件支持（PDF、PPT、Word、代码文件等）
2. 代码文件分析
3. 文件快速总结
4. 动态Skill生成
"""

from typing import Dict, List, Optional
from pathlib import Path
import mimetypes

# 支持的文件类型
SUPPORTED_FILE_TYPES = {
    # 文档类
    'pdf': {'category': 'document', 'icon': '📄', 'color': '#EF4444'},
    'doc': {'category': 'document', 'icon': '📘', 'color': '#3B82F6'},
    'docx': {'category': 'document', 'icon': '📘', 'color': '#3B82F6'},
    'ppt': {'category': 'presentation', 'icon': '📊', 'color': '#F59E0B'},
    'pptx': {'category': 'presentation', 'icon': '📊', 'color': '#F59E0B'},
    'txt': {'category': 'text', 'icon': '📝', 'color': '#6B7280'},
    'md': {'category': 'text', 'icon': '📝', 'color': '#8B5CF6'},
    
    # 代码类
    'py': {'category': 'code', 'icon': '🐍', 'color': '#3776AB'},
    'js': {'category': 'code', 'icon': '📜', 'color': '#F7DF1E'},
    'ts': {'category': 'code', 'icon': '📜', 'color': '#3178C6'},
    'java': {'category': 'code', 'icon': '☕', 'color': '#007396'},
    'cpp': {'category': 'code', 'icon': '⚙️', 'color': '#00599C'},
    'c': {'category': 'code', 'icon': '⚙️', 'color': '#A8B9CC'},
    'go': {'category': 'code', 'icon': '🔷', 'color': '#00ADD8'},
    'rs': {'category': 'code', 'icon': '🦀', 'color': '#CE412B'},
    'html': {'category': 'code', 'icon': '🌐', 'color': '#E34F26'},
    'css': {'category': 'code', 'icon': '🎨', 'color': '#1572B6'},
    'json': {'category': 'code', 'icon': '{}', 'color': '#000000'},
    'xml': {'category': 'code', 'icon': '<>', 'color': '#0060AC'},
}

def get_file_info(filename: str) -> Dict:
    """获取文件信息"""
    ext = Path(filename).suffix[1:].lower()  # 去掉点号
    
    info = SUPPORTED_FILE_TYPES.get(ext, {
        'category': 'unknown',
        'icon': '📎',
        'color': '#9CA3AF'
    })
    
    return {
        **info,
        'extension': ext,
        'filename': filename,
        'is_code': info['category'] == 'code',
        'is_document': info['category'] in ['document', 'presentation', 'text']
    }

def is_supported_file(filename: str) -> bool:
    """检查文件是否支持"""
    ext = Path(filename).suffix[1:].lower()
    return ext in SUPPORTED_FILE_TYPES

def get_code_analysis_prompt(code_content: str, language: str) -> str:
    """生成代码分析提示词"""
    return f"""你是一位资深的代码审查专家。请分析以下{language}代码，并给出详细的评估：

**代码内容**：
```{language}
{code_content}
```

**请从以下维度进行分析**：

1. **代码质量评分**（满分10分）
   - 可读性
   - 可维护性
   - 性能效率
   - 安全性

2. **优点**
   - 列出代码的亮点和优秀实践

3. **问题与改进建议**
   - 指出存在的问题
   - 提供具体的改进方案
   - 如有必要，给出改进后的代码示例

4. **最佳实践建议**
   - 针对该语言的最佳实践建议
   - 推荐的设计模式或编程范式

5. **学习建议**
   - 如果是学生代码，给出学习方向和资源推荐

请用清晰的格式输出，便于阅读和理解。"""

def get_document_summary_prompt(content: str, filename: str) -> str:
    """生成文档总结提示词"""
    return f"""你是一位专业的文档分析专家。请对以下文档内容进行快速总结：

**文档名称**：{filename}

**文档内容**：
{content[:5000]}  # 限制长度，避免超过token限制

**请提供以下内容**：

1. **核心要点**（3-5个关键点）
2. **主要内容摘要**（150-200字）
3. **适合学习的重点**（如果是教学材料）
4. **相关问题建议**（可以向AI提问的3-5个问题）

请用简洁、结构化的方式输出。"""

# 代码分析的动态Skill模板
CODE_ANALYSIS_SKILL_TEMPLATE = """你是一位专业的 {language} 代码审查专家。

**你的专长**：
- 深入理解 {language} 语言特性和最佳实践
- 能够发现代码中的潜在问题、性能瓶颈和安全隐患
- 提供具体、可操作的改进建议
- 善于用清晰的方式解释复杂的概念

**分析维度**：
1. 代码质量（可读性、可维护性、规范性）
2. 性能优化建议
3. 安全性问题
4. 最佳实践对照
5. 学习改进方向

**回答风格**：
- 结构化、分点说明
- 优点和问题并重
- 提供具体的代码示例
- 鼓励性的学习建议

请始终保持专业、友好的态度，帮助用户提升编程能力。"""

# 文档总结的动态Skill模板  
DOCUMENT_SUMMARY_SKILL_TEMPLATE = """你是一位专业的文档分析和知识提炼专家。

**你的专长**：
- 快速抓取文档的核心要点
- 结构化梳理知识点
- 提炼适合学习的重点内容
- 生成有价值的学习问题

**工作方式**：
1. 快速浏览文档，识别主题和结构
2. 提取关键概念和重要信息
3. 总结核心要点（3-5个）
4. 提供学习建议和延伸问题

**回答风格**：
- 简洁、结构化
- 突出重点，避免冗余
- 提供可操作的学习建议
- 激发进一步探索的兴趣

请帮助用户高效理解和掌握文档内容。"""

def generate_dynamic_skill(file_info: Dict, content_preview: str) -> Optional[Dict]:
    """根据文件类型生成动态Skill"""
    if file_info['is_code']:
        # 代码文件 - 生成代码分析Skill
        language = file_info['extension'].upper()
        return {
            'name': f'{language}代码分析专家',
            'description': f'专门分析{language}代码的质量、性能和最佳实践',
            'prompt': CODE_ANALYSIS_SKILL_TEMPLATE.format(language=language),
            'category': 'code_analysis',
            'is_dynamic': True
        }
    elif file_info['is_document']:
        # 文档文件 - 生成文档总结Skill
        return {
            'name': f'文档总结专家',
            'description': f'快速总结和提炼文档核心要点',
            'prompt': DOCUMENT_SUMMARY_SKILL_TEMPLATE,
            'category': 'document_summary',
            'is_dynamic': True
        }
    
    return None
