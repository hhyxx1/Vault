# 前端项目

基于 React + TypeScript + Vite + Tailwind CSS 构建的智能教学平台前端应用。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理
- **Tailwind CSS** - 样式框架
- **Axios** - HTTP 客户端

## 项目结构

```
src/
├── assets/          # 静态资源（图片、字体等）
├── components/      # 公共组件
├── hooks/           # 自定义 React Hooks
├── layouts/         # 布局组件
│   ├── StudentLayout.tsx   # 学生端布局
│   └── TeacherLayout.tsx   # 教师端布局
├── pages/           # 页面组件
│   ├── student/     # 学生端页面
│   │   ├── QA/      # 智能问答页面
│   │   └── Survey/  # 问卷页面
│   └── teacher/     # 教师端页面
│       ├── Dashboard/  # 教师看板
│       └── Survey/     # 问卷管理
├── router/          # 路由配置
├── services/        # API 服务层
├── types/           # TypeScript 类型定义
├── utils/           # 工具函数
├── App.tsx          # 应用入口组件
├── main.tsx         # 应用挂载入口
└── index.css        # 全局样式
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## 路由说明

- `/student` - 学生端
  - `/student/qa` - 智能问答
  - `/student/survey` - 问卷调查
- `/teacher` - 教师端
  - `/teacher/dashboard` - 教师看板
  - `/teacher/survey` - 问卷管理

## 代码规范

项目使用 ESLint 进行代码检查：

```bash
npm run lint
```
