# Workstream B: 学生智能问答系统详细工作流文档

本文档详细描述了学生端智能问答系统（B 工作流）的当前实现状态以及未来待开发的功能规划。

---

## 1. 已实现工作流 (Current Implementation)

### 1.1 基础环境与访问
*   **登录绕过机制**：前端 `ProtectedRoute` 已配置为开发模式下的认证豁免，允许直接通过 `/student/qa` 路径进入系统。
*   **后端服务自愈**：修复了核心单例导入错误、类型定义缺失及 `uuid` 模块缺失等阻塞性问题，确保后端服务稳定运行在 `8000` 端口。

### 1.2 知识库构建流程 (File Upload & Ingestion)
1.  **文件提交**：前端通过 `FormData` 将文件（PDF, TXT, Code）提交至 `/api/student/qa/upload` 接口。
2.  **高性能解析**：后端调用 `DocumentParser` (基于 Docling) 将二进制文件转换为高保真 Markdown 格式。
3.  **语义分块 (Smart Splitting)**：
    *   分块大小：800 字符。
    *   重叠大小：150 字符。
    *   确保知识点在切分时保持上下文语义连贯。
4.  **向量化存储**：
    *   **当前状态**：使用 Mock 模式生成 384 维向量（全零/固定向量），以加速开发环境下的响应速度。
    *   **存储引擎**：ChromaDB 持久化存储，数据位于 `backend/data/chroma_db`。

### 1.3 智能答疑流程 (RAG Flow)
1.  **意图检索**：
    *   用户提问后，系统将问题向量化并从 ChromaDB 中检索 Top-3 最相关的知识片段。
2.  **Prompt 增强**：
    *   从 `skill_loader` 加载“智能问答专家”技能模板。
    *   将检索到的上下文 (Context) 注入 System Prompt，要求 AI 必须基于参考知识回答。
3.  **AI 生成**：
    *   集成 DeepSeek-V1 模型，采用低随机性 (Temperature=0.3) 配置。
    *   输出包含：详细解答、来源引用、以及后续引导性测试问题。
4.  **结果反馈**：前端实时显示 AI 回答，并渲染可交互的“参考资料”标签。

---

## 2. 待实现工作流 (Pending Roadmap)

### 2.1 数据持久化与会话管理 (High Priority)
*   **数据库集成**：目前会话 ID 和学生 ID 均为硬编码（如 `test_student`）。需要接入 SQLAlchemy/PostgreSQL 存储真实的 `QASession` 和 `QARecord`。
*   **历史记录查询**：实现 `GET /api/student/qa/history` 接口，允许学生查看并恢复之前的问答对话。
*   **会话自动命名**：利用 AI 自动根据对话前两句内容生成会话标题。

### 2.2 生产级算法增强 (Medium Priority)
*   **真实 Embedding 集成**：移除 Mock 向量模式，接入 `SentenceTransformer` (如 `paraphrase-multilingual-MiniLM-L12-v2`) 实现真实的语义相似度搜索。
*   **多源知识融合**：支持从课程资料库 (Course Documents) 中自动同步资料到个人问答知识库，无需手动重复上传。
*   **多模态支持**：扩展解析能力，支持 Excel 数据表格解析及图片 OCR（目前仅限文本/代码/PDF）。

### 2.3 UI/UX 体验优化 (Low Priority)
*   **控制台错误清理**：
    *   修复 `CourseDocumentsDialog.tsx` 在某些课程下的加载异常。
    *   解决学生个人信息 (Profile) 加载失败的 Network Error。
*   **流式输出 (Streaming)**：目前采用全量返回模式，需改为 Server-Sent Events (SSE) 以实现类似 ChatGPT 的逐字输出效果。
*   **移动端适配**：优化对话框在窄屏下的显示效果，确保附件上传按钮易于操作。

---

## 3. 关键文件索引

*   **前端核心**：[QA/index.tsx](file:///c:/Users/夜澜衣/Desktop/Vault/frontend/src/pages/student/QA/index.tsx) - UI 与状态逻辑。
*   **后端 API**：[qa.py](file:///c:/Users/夜澜衣/Desktop/Vault/backend/app/api/student/qa.py) - 路由入口。
*   **业务逻辑**：[qa_service.py](file:///c:/Users/夜澜衣/Desktop/Vault/backend/app/services/qa_service.py) - RAG 编排逻辑。
*   **底层支撑**：[vector_db_service.py](file:///c:/Users/夜澜衣/Desktop/Vault/backend/app/services/vector_db_service.py) - 向量库操作。

---
*文档版本: v1.1 | 编制日期: 2026-02-04*
