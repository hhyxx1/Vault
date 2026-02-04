# AI问卷生成功能使用指南

## 功能概述

本功能实现了完整的AI问卷生成、编辑和保存流程。

## 功能流程

### 1. 生成问卷

#### 方式一：AI生成
1. 点击"AI生成问卷"按钮
2. 在弹窗中输入描述（例如："帮我生成一套关于操作系统的测试题"）
3. 设置题目数量（5-30题）
4. 可选：选择题型（选择题、判断题、问答题）
5. 点击"生成问卷"

#### 方式二：知识库生成
1. 点击"基于知识库生成"按钮
2. 输入描述（例如："生成关于进程管理的测试题"）
3. 选择课程（必填）
4. 设置题目数量和题型
5. 点击"生成问卷"

### 2. 编辑问卷

生成完成后自动进入编辑器：

#### 基本信息编辑
- **问卷标题**：可修改AI生成的标题
- **问卷描述**：可修改描述内容

#### 题目编辑
每道题目支持：
- ✏️ **编辑题目内容**：修改题目文字
- ✏️ **编辑选项**：修改选择题/判断题的选项
- ✏️ **修改正确答案**：通过下拉菜单选择
- ✏️ **调整分数**：每题分数可单独调整
- ✏️ **编辑解析**：修改答案解析内容
- 🗑️ **删除题目**：点击删除图标
- ⬆️⬇️ **调整顺序**：使用上移/下移按钮

#### 题目信息
- 题型标签：选择题/判断题/问答题
- 分数标签：显示该题分数
- 知识来源：显示题目来源（AI生成或知识库）

### 3. 保存问卷

编辑完成后：
1. 检查总分是否为100分（系统会提示）
2. 点击"保存问卷"按钮
3. 系统验证并保存到数据库
4. 保存成功后返回问卷列表

### 4. 问卷列表

保存后的问卷会显示在列表中：

#### 卡片信息
- 标题和描述
- 生成方式标签（AI生成/知识库生成）
- 状态标签（草稿/已发布）
- 题目数量和总分
- 创建时间和更新时间

#### 操作按钮
- 👁️ **查看**：查看问卷详情
- ✏️ **编辑**：编辑问卷（仅草稿状态）
- ✅ **发布**：发布给学生（草稿状态）
- 🗑️ **删除**：删除问卷

### 5. 标签页过滤

- **全部问卷**：显示所有问卷
- **AI生成**：只显示AI生成的问卷
- **知识库生成**：只显示基于知识库生成的问卷
- **草稿**：只显示草稿状态的问卷
- **已发布**：只显示已发布的问卷

## 后端API接口

### 1. 生成问卷

#### AI生成
```http
POST /api/teacher/survey-generation/generate/ai
Content-Type: application/json

{
  "description": "帮我生成一套关于操作系统的测试题",
  "question_count": 10,
  "include_types": ["choice", "judge"],  // 可选
  "course_id": "1",  // 可选
  "auto_save": false  // 默认false，不自动保存
}
```

#### 知识库生成
```http
POST /api/teacher/survey-generation/generate/knowledge-based
Content-Type: application/json

{
  "description": "生成关于进程管理的测试题",
  "course_id": "1",  // 必填
  "question_count": 10,
  "include_types": ["choice", "judge"],  // 可选
  "auto_save": false
}
```

**响应**：
```json
{
  "success": true,
  "message": "问卷生成成功",
  "data": {
    "survey_title": "操作系统基础测试",
    "description": "本问卷涵盖操作系统核心知识点",
    "questions": [
      {
        "question_type": "choice",
        "question_text": "以下哪个不是操作系统的功能？",
        "options": ["A. 进程管理", "B. 内存管理", ...],
        "correct_answer": "D",
        "score": 5,
        "explanation": "...",
        "knowledge_source": "基于主题深度思考"
      }
    ]
  },
  "survey_id": null  // 因为auto_save=false
}
```

### 2. 保存问卷

```http
POST /api/teacher/survey-generation/save
Content-Type: application/json

{
  "survey_title": "操作系统基础测试",
  "description": "本问卷涵盖操作系统核心知识点",
  "questions": [...],  // 题目数组
  "course_id": "1",  // 可选
  "generation_method": "ai",  // ai/knowledge_based/manual
  "generation_prompt": "帮我生成一套关于操作系统的测试题"
}
```

**响应**：
```json
{
  "success": true,
  "message": "问卷保存成功",
  "survey_id": "uuid-xxxx-xxxx"
}
```

### 3. 获取问卷列表

```http
GET /api/teacher/survey-generation/list?limit=20&status=draft&course_id=1
```

**响应**：
```json
{
  "success": true,
  "total": 15,
  "surveys": [
    {
      "id": "uuid-xxxx",
      "title": "操作系统基础测试",
      "description": "...",
      "generation_method": "ai",
      "status": "draft",
      "total_score": 100,
      "question_count": 10,
      "created_at": "2026-02-01T10:00:00",
      "updated_at": "2026-02-01T10:05:00"
    }
  ]
}
```

## 数据库表结构

### surveys 表
- `id`: UUID主键
- `title`: 问卷标题
- `description`: 问卷描述
- `teacher_id`: 教师ID
- `course_id`: 课程ID（可选）
- `generation_method`: 生成方式（ai/knowledge_based/manual）
- `generation_prompt`: 生成提示词
- `status`: 状态（draft/published/closed/archived）
- `total_score`: 总分
- `created_at`: 创建时间
- `updated_at`: 更新时间

### questions 表
- `id`: UUID主键
- `survey_id`: 问卷ID（外键）
- `question_type`: 题型（choice/judge/essay）
- `question_text`: 题目内容
- `question_order`: 题目顺序
- `score`: 分数
- `options`: 选项（JSONB）
- `correct_answer`: 正确答案（JSONB）
- `answer_explanation`: 答案解析
- `knowledge_points`: 知识点数组
- `created_at`: 创建时间

## 技术特性

### 1. AI深度思考模式
- 使用DeepSeek API生成高质量题目
- 思维链推理确保答案正确性
- 自动标注知识来源

### 2. 质量保证
- 答案验证机制
- 解析长度检查（≥50字）
- 总分验证（建议100分）
- 题目格式验证

### 3. 用户体验
- 实时编辑预览
- 拖拽排序（待实现）
- 批量操作（待实现）
- 自动保存草稿（待实现）

## 常见问题

### Q1: 生成的题目总分不是100分怎么办？
A: 编辑器会提示总分异常，你可以手动调整每题分数，系统会实时显示总分。保存时如果不是100分，会弹出确认框。

### Q2: 可以删除题目吗？
A: 可以。点击题目卡片右上角的删除图标即可删除。

### Q3: 如何修改题目顺序？
A: 使用题目卡片右上角的上移/下移按钮。

### Q4: 知识库模式和AI模式有什么区别？
A: 
- **AI模式**：完全基于AI推理生成，适合没有知识库内容的情况
- **知识库模式**：优先使用课程文档中的知识，题目更贴近教学内容

### Q5: 保存后还能编辑吗？
A: 草稿状态的问卷可以编辑，已发布的问卷不能编辑（避免影响已提交的学生）。

## 下一步优化

- [ ] 添加拖拽排序功能
- [ ] 实现自动保存草稿
- [ ] 添加题目模板
- [ ] 支持导出问卷（Word/PDF）
- [ ] 添加题目难度评估
- [ ] 实现批量编辑
- [ ] 添加问卷预览功能
- [ ] 支持问卷复制

## 安装依赖

前端需要安装：
```bash
cd project/frontend
npm install moment antd @ant-design/icons axios
```

## 启动服务

```bash
# 后端
cd project/backend
python app/main.py

# 前端
cd project/frontend
npm run dev
```

访问：http://localhost:5173/teacher/ai-survey
