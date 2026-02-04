# Word文档上传与问卷生成功能使用指南

## 功能概述

教师可以上传Word文档，系统会自动解析文档中的题目，并以弹窗形式展示解析结果。教师可以对解析后的题目进行检查和修改，确认无误后保存到向量数据库中，用于后续的问卷管理和语义搜索。

## 使用步骤

### 1. 准备Word文档

按照以下格式编写题目：

**单选题格式：**
```
1. 题目内容？
A. 选项1
B. 选项2
C. 选项3
D. 选项4
```

**问答题格式：**
```
5. 请简述xxx？
```

**示例文档：**
```
1. 栈的特点是什么？
A. 先进先出
B. 后进先出
C. 随机存取
D. 顺序存取

2. 队列的特点是什么？
A. 先进先出
B. 后进先出
C. 随机存取
D. 顺序存取

3. 请简述栈和队列的区别。
```

### 2. 上传文档

1. 登录教师端
2. 进入"问卷管理"页面
3. 点击"出题助手"或选择"手动上传"方式
4. 在弹窗中点击上传区域，选择Word文档（.doc或.docx）
5. 点击"开始识别"按钮

### 3. 检查并编辑题目

上传成功后，系统会自动解析并显示题目预览弹窗：

- **题目列表**：显示所有解析出的题目
- **题目编辑**：可以直接修改题目内容
- **选项编辑**：可以修改选择题的选项文本
- **删除题目**：点击🗑️图标可删除不需要的题目
- **错误提示**：如果解析过程中发现格式问题，会在顶部显示警告

### 4. 保存题目

确认题目无误后，点击"保存问题"按钮，题目会：
- 保存到数据库（待实现）
- 存储到向量数据库（用于语义搜索）
- 可在后续问卷中重复使用

## 向量数据库说明

### 什么是向量数据库？

向量数据库将文档内容转换为向量（数字数组），可以进行语义相似度搜索。即使查询词与原文不完全相同，也能找到相关内容。

### 本项目使用的技术

- **数据库**: ChromaDB（轻量级向量数据库）
- **向量模型**: paraphrase-multilingual-MiniLM-L12-v2（支持中文）
- **存储路径**: `backend/data/chroma_db/`

### 功能特点

1. **语义搜索**: 输入"栈的特点"可以找到所有与栈相关的题目
2. **持久化存储**: 文档向量保存在本地，重启后仍可使用
3. **元数据过滤**: 可以按科目、难度等标签筛选
4. **去重功能**: 避免重复上传相同题目

## 技术实现

### 后端服务

#### 1. 文档解析服务 (`document_parser.py`)

```python
from app.services.document_parser import doc_parser

# 解析Word文档
questions = doc_parser.parse_word("文件路径.docx")

# 验证解析结果
validation = doc_parser.validate_questions(questions)
```

#### 2. 向量数据库服务 (`vector_db_service.py`)

```python
from app.services.vector_db_service import get_vector_db

db = get_vector_db()

# 添加文档
db.add_document(
    doc_id="unique_id",
    content="文档内容",
    metadata={"subject": "数据结构", "difficulty": "easy"}
)

# 搜索相似文档
results = db.search_similar("栈的特点", n_results=5)

# 获取统计信息
stats = db.get_stats()
```

#### 3. API端点 (`api/teacher/survey.py`)

**上传Word文档**
```
POST /api/teacher/surveys/upload-word
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "file_id": "uuid",
  "filename": "test.docx",
  "questions": [...],
  "validation": {
    "is_valid": true,
    "errors": [],
    "question_count": 10
  }
}
```

**搜索相似问题**
```
GET /api/teacher/surveys/search-similar?query=栈的特点&limit=5

Response:
{
  "success": true,
  "query": "栈的特点",
  "results": [
    {
      "id": "doc_id",
      "content": "问题内容...",
      "metadata": {...},
      "similarity": 0.85
    }
  ]
}
```

### 前端实现

#### 1. 文件上传

```typescript
import { surveyApi } from '@/services'

const handleUpload = async (file: File) => {
  const result = await surveyApi.uploadWord(file)
  if (result.success) {
    setParsedQuestions(result.questions)
    setShowPreviewModal(true)
  }
}
```

#### 2. 题目编辑

- 使用React状态管理解析后的题目
- textarea和input组件支持实时编辑
- 删除功能过滤数组元素

#### 3. 预览弹窗

- 显示所有解析的题目
- 支持题目内容和选项的修改
- 显示解析错误和警告
- 确认后保存到数据库

## 维护和管理

### 查看向量数据库统计

```python
from app.services.vector_db_service import get_vector_db

db = get_vector_db()
stats = db.get_stats()
print(f"总文档数: {stats['total_documents']}")
```

### 清理测试数据

```python
# 删除指定文档
db.delete_document("document_id")
```

### 数据备份

向量数据库数据位于：
```
backend/data/chroma_db/
```

可以直接复制此目录进行备份。

## 常见问题

### Q: 支持哪些Word格式？
A: 支持 .doc 和 .docx 格式，推荐使用 .docx（Word 2007及以上版本）。

### Q: 文件大小限制？
A: 建议单个文件不超过10MB，题目数量不超过100题。

### Q: 解析错误怎么办？
A: 
1. 检查Word文档格式是否正确
2. 确保题号和选项标识符正确（1. 或 1、, A. 或 A、）
3. 查看错误提示，手动修正问题

### Q: 向量数据库占用多少空间？
A: 
- 向量模型：约470MB（首次下载）
- 每个文档：约几KB到几十KB
- 1000个题目约占用几十MB

### Q: 如何重新初始化向量数据库？
A: 删除 `backend/data/chroma_db/` 目录，重启服务即可。

### Q: 能否导入PDF文件？
A: 当前仅支持Word文档，PDF支持可以通过安装PyPDF2包并修改解析服务实现。

## 后续优化方向

1. **批量上传**: 支持一次上传多个Word文档
2. **模板管理**: 提供题目格式模板下载
3. **智能纠错**: 自动识别并修正格式错误
4. **题目推荐**: 基于向量数据库推荐相似题目
5. **导出功能**: 将题库导出为Word或Excel
6. **版本控制**: 记录题目的修改历史
7. **标签系统**: 为题目添加科目、难度、知识点等标签
8. **去重检测**: 上传前检测是否已存在相似题目

## 测试

运行测试脚本检查服务是否正常：

```bash
cd backend
python tests/test_services.py
```

预期输出：
```
✓ 向量数据库服务测试通过!
✓ 文档解析服务测试通过!
✅ 所有测试通过!
```

## 联系支持

如遇到问题，请检查：
1. Python依赖是否完整安装
2. 后端服务是否正常运行
3. 向量模型是否下载完成（首次使用需要下载约470MB）
4. 网络连接是否正常（首次需要联网下载模型）
