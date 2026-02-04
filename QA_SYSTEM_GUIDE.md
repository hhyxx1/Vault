# 智能问答系统 (Intelligent QA System) 说明文档

## 1. 项目简介
本项目是一个基于 RAG (Retrieval-Augmented Generation) 架构的智能教学问答系统。它允许学生上传课程相关的学习资料（PDF、代码、文档等），并通过 AI 助手针对这些资料进行深度问答。

## 2. 核心功能
*   **免登录测试模式**：为了方便快速迭代，系统已配置为跳过登录校验。
*   **多格式文档解析**：支持 PDF、Python、JS/TS、TXT 等多种格式，使用 Docling 进行高精度 Markdown 解析。
*   **智能语义检索**：基于 ChromaDB 向量数据库，实现知识点的精准匹配。
*   **AI 智能答疑**：接入 DeepSeek-V1 模型，生成带有来源标注的专业回答。
*   **出处溯源**：所有 AI 回答均提供参考来源，支持点击查看具体文件出处。

## 3. 快速启动指南

### 后端启动 (Backend)
1. 进入 `backend` 目录。
2. 运行 `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`。
3. 后端服务将运行在 `http://127.0.0.1:8000`。

### 前端启动 (Frontend)
1. 进入 `frontend` 目录。
2. 运行 `npm run dev`。
3. 前端服务将运行在 `http://localhost:3000`。

### 访问路径
直接访问：`http://localhost:3000/student/qa`

## 4. 架构设计

### 前端 (Frontend)
*   **技术栈**：React 18 + TypeScript + TailwindCSS。
*   **核心组件**：`StudentQA` (位于 `src/pages/student/QA/index.tsx`)。
*   **通讯**：使用 Axios 与后端 REST API 交互。

### 后端 (Backend)
*   **框架**：FastAPI。
*   **服务层**：
    *   `QAService`：核心业务逻辑，处理文件解析、向量库入库及 AI 生成。
    *   `VectorDBService`：封装 ChromaDB 操作，提供向量搜索。
    *   `DocumentParser`：基于 Docling 的多格式文档解析服务。

### 数据存储
*   **向量库**：ChromaDB (存储在 `backend/data/chroma_db`)。
*   **上传目录**：`backend/static/uploads/qa`。

## 5. 开发者笔记
*   **Mock 模式**：为解决大型 Embedding 模型加载慢的问题，当前系统在 `VectorDBService` 中开启了 Mock 向量模式。
*   **登录绕过**：`ProtectedRoute.tsx` 中已暂时移除 Token 校验。
*   **API 密钥**：DeepSeek API 密钥已配置在 `QAService` 初始化中。

## 6. 自动化测试
可以使用根目录下的 `verify_qa_flow.py` 脚本进行端到端流程验证：
```bash
python verify_qa_flow.py
```

---
*Last Updated: 2026-02-04*
