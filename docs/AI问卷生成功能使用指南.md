# AI问卷生成功能使用指南

## 📚 功能概述

基于chat-skills架构实现的智能问卷生成系统，支持两种生成模式：

1. **AI生成** - 根据描述直接生成问卷
2. **基于知识库** - 从课程文档提取内容生成问卷

## 🏗️ 架构设计

### 核心组件

```
┌─────────────────────────────────────────┐
│         技能模板 (Skills)                │
│  - survey_generation_ai.md              │
│  - survey_generation_kb.md              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      SkillLoader (技能加载器)            │
│  - 扫描并解析技能文件                    │
│  - 提供技能查询接口                      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  SurveyGenerationService (生成服务)      │
│  - 注入技能到系统提示                    │
│  - 调用DeepSeek API                     │
│  - 解析JSON响应                         │
│  - 集成向量数据库检索                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      API端点 (FastAPI Router)           │
│  - POST /generate/ai                    │
│  - POST /generate/knowledge-based       │
└─────────────────────────────────────────┘
```

## 🎯 API使用方法

### 1. AI生成问卷

**端点**: `POST /api/teacher/survey-generation/generate/ai`

**请求示例**:
```json
{
  "description": "生成一份Python基础语法测试题，包含变量、数据类型、控制流等内容",
  "question_count": 10,
  "include_types": ["choice", "judge", "essay"]
}
```

**参数说明**:
- `description` (必填): 问卷描述，至少5个字符
- `question_count` (可选): 题目数量，默认10，范围5-30
- `include_types` (可选): 题型数组，可选值：
  - `"choice"` - 选择题
  - `"judge"` - 判断题
  - `"essay"` - 问答题

**响应示例**:
```json
{
  "success": true,
  "message": "问卷生成成功",
  "data": {
    "survey_title": "Python基础语法测试",
    "description": "本测试涵盖Python基础语法知识...",
    "questions": [
      {
        "question_type": "choice",
        "question_text": "以下哪个是Python中的合法变量名？",
        "options": ["A. 2variable", "B. my-variable", "C. my_variable", "D. for"],
        "correct_answer": "C",
        "score": 5,
        "explanation": "C正确：Python变量名可以包含字母、数字和下划线..."
      },
      // ... 更多题目
    ]
  }
}
```

### 2. 基于知识库生成

**端点**: `POST /api/teacher/survey-generation/generate/knowledge-based`

**请求示例**:
```json
{
  "description": "生成操作系统进程管理相关的测试题",
  "course_id": 1,
  "question_count": 10,
  "include_types": ["choice", "judge", "essay"]
}
```

**参数说明**:
- `description` (必填): 问卷描述
- `course_id` (必填): 课程ID
- `question_count` (可选): 题目数量
- `include_types` (可选): 题型数组

**响应格式**: 与AI生成相同，但额外包含：
```json
{
  "data": {
    "knowledge_sources": ["文档1.pdf", "文档2.docx"],
    "questions": [
      {
        // ... 基本字段
        "knowledge_source": "操作系统教程.pdf - 第3章进程管理"
      }
    ]
  }
}
```

### 3. 测试技能加载

**端点**: `GET /api/teacher/survey-generation/test-skills`

用于调试，查看已加载的技能。

## 🔧 本地测试

### 方式1: 使用测试脚本

```bash
cd f:\sjtu_project\project\backend
python test_survey_generation.py
```

### 方式2: 通过API文档

1. 启动后端服务:
```bash
cd f:\sjtu_project\project\backend
python app/main.py
```

2. 打开浏览器访问: http://127.0.0.1:8000/docs

3. 找到 "教师-AI问卷生成" 分组

4. 展开 `POST /api/teacher/survey-generation/generate/ai`

5. 点击 "Try it out"

6. 填写请求数据并执行

## 📝 技能模板说明

### AI生成技能模板

位置: `backend/skills/survey_generation_ai.md`

**核心内容**:
- 问卷JSON格式规范
- 三种题型的详细要求
- 生成原则和质量标准
- 示例输出

**特点**:
- 确保AI输出标准JSON格式
- 严格的字段验证
- 详细的解析要求

### 知识库生成技能模板

位置: `backend/skills/survey_generation_kb.md`

**核心内容**:
- 基于检索内容生成的规范
- 知识来源标注要求
- 内容准确性要求

**特点**:
- 每题必须标注 `knowledge_source`
- 不能编造知识库外的内容
- 答案必须与文档一致

## 🔑 关键技术点

### 1. 技能注入机制

参考chat-skills的设计，将技能内容注入到系统提示：

```python
system_prompt = f"""
{base_prompt}

==================================================
技能指导内容（必须遵循）
==================================================
{skill.content}
==================================================

重要提醒：
- 严格按照上述技能模板生成内容
- 只输出JSON格式
"""
```

### 2. JSON响应解析

处理AI可能返回的各种格式：
- 纯JSON
- 带markdown代码块的JSON
- 混杂其他文字的JSON

```python
# 移除markdown代码块
if cleaned_text.startswith("```"):
    lines = cleaned_text.split("\n")
    lines = lines[1:-1]  # 移除首尾```
    cleaned_text = "\n".join(lines)

# 正则提取JSON
json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
```

### 3. 向量数据库集成

基于知识库生成时，先从ChromaDB检索：

```python
results = self.vector_service.query_similar_documents(
    query_text=query,
    course_id=course_id,
    top_k=5
)
```

然后将检索结果格式化后注入提示。

## 🎨 前端集成建议

### 创建AI生成对话框

```typescript
// 调用AI生成API
const generateWithAI = async (description: string) => {
  const response = await fetch('/api/teacher/survey-generation/generate/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      description,
      question_count: 10,
      include_types: ['choice', 'judge', 'essay']
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // 展示生成的问卷
    displaySurvey(result.data);
  }
};
```

### 界面布局

```
┌─────────────────────────────────────┐
│  AI生成问卷                          │
├─────────────────────────────────────┤
│  描述输入框:                         │
│  ┌────────────────────────────────┐ │
│  │ 请描述您要生成的问卷内容...      │ │
│  └────────────────────────────────┘ │
│                                      │
│  题目数量: [10]  ▼                   │
│                                      │
│  题型选择:                           │
│  ☑ 选择题  ☑ 判断题  ☑ 问答题       │
│                                      │
│  [生成问卷]  [基于知识库生成]        │
└─────────────────────────────────────┘
```

## ⚙️ 配置说明

### DeepSeek API配置

当前硬编码在 `survey_generation_service.py`:

```python
self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
self.base_url = "https://api.deepseek.com/v1"
self.model_name = "deepseek-chat"
```

**建议**: 移到环境变量或配置文件：

```python
from app.config.settings import settings

self.api_key = settings.DEEPSEEK_API_KEY
```

## 🐛 常见问题

### Q1: 技能加载失败
**原因**: skills目录不存在或路径错误  
**解决**: 确保 `backend/skills/` 目录存在，包含两个.md文件

### Q2: API调用失败
**原因**: DeepSeek API密钥无效或网络问题  
**解决**: 检查API密钥，测试网络连接

### Q3: JSON解析错误
**原因**: AI返回的格式不标准  
**解决**: 检查技能模板的提示是否足够明确，可能需要调整temperature参数

### Q4: 知识库无结果
**原因**: 课程未上传文档或向量数据库未初始化  
**解决**: 先上传课程文档，确保ChromaDB正常工作

## 📊 性能优化

1. **缓存技能内容**: 避免重复加载
2. **异步调用**: 使用async/await提升响应速度
3. **流式返回**: 对于长问卷，可考虑流式生成
4. **批量生成**: 支持一次生成多份问卷

## 🔒 安全建议

1. **权限控制**: 只允许教师角色使用
2. **速率限制**: 防止API滥用
3. **内容审核**: 对生成的题目进行敏感词过滤
4. **API密钥**: 不要将密钥硬编码，使用环境变量

## 📈 后续扩展

1. **更多题型**: 填空题、匹配题等
2. **难度控制**: 指定题目难度等级
3. **题库积累**: 将生成的题目存入题库
4. **批量导入**: 支持从生成结果直接创建问卷
5. **智能推荐**: 根据课程内容自动推荐题型分布
