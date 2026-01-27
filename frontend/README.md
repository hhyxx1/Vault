# 前端安装与运行指南

## 环境要求
- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器

## 快速开始

### 1. 检查Node.js版本

```bash
node --version  # 应显示 v16.x.x 或更高
npm --version   # 应显示 8.x.x 或更高
```

如果版本过低，请访问 https://nodejs.org/ 下载最新LTS版本。

### 2. 安装依赖

```bash
# 进入frontend目录
cd frontend

# 安装所有依赖包
npm install

# 或使用yarn（如果已安装）
yarn install
```

**注意事项：**
- 首次安装可能需要5-15分钟
- 如遇网络问题，可使用国内镜像：
  ```bash
  npm config set registry https://registry.npmmirror.com
  npm install
  ```

### 3. 配置API地址

前端默认连接到 `http://localhost:8000`

如需修改，编辑 `src/services/api.ts`：
```typescript
const api = axios.create({
  baseURL: 'http://localhost:8000',  // 修改为你的后端地址
  timeout: 10000,
})
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务将运行在 http://localhost:3000 或 http://localhost:5173

浏览器会自动打开，如未打开，请手动访问上述地址。

### 5. 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/` 目录，可部署到任何静态服务器。

## 项目结构

```
frontend/
├── public/              # 静态资源
├── src/
│   ├── assets/          # 图片、图标等资源
│   ├── components/      # 可复用组件
│   ├── hooks/           # 自定义React Hooks
│   ├── layouts/         # 布局组件
│   │   ├── StudentLayout.tsx  # 学生端布局
│   │   └── TeacherLayout.tsx  # 教师端布局
│   ├── pages/           # 页面组件
│   │   ├── Login/       # ✅ 登录页 - 已完成
│   │   ├── Register/    # ✅ 注册页 - 已完成
│   │   ├── student/     # 学生端页面
│   │   │   ├── QA/      # ⏳ 问答页 - TODO
│   │   │   └── Survey/  # ⏳ 问卷页 - TODO
│   │   └── teacher/     # 教师端页面
│   │       ├── Dashboard/ # ⏳ 看板页 - TODO
│   │       └── Survey/    # ⏳ 问卷管理页 - TODO
│   ├── router/          # 路由配置
│   │   └── index.tsx    # ✅ 路由定义
│   ├── services/        # API服务
│   │   ├── api.ts       # ✅ Axios配置
│   │   └── index.ts     # ✅ API方法封装
│   ├── types/           # TypeScript类型定义
│   │   └── index.ts     # ✅ 通用类型
│   ├── utils/           # 工具函数
│   │   └── format.ts    # 格式化函数
│   ├── App.tsx          # ✅ 根组件
│   ├── main.tsx         # ✅ 应用入口
│   └── index.css        # ✅ 全局样式（Tailwind）
│
├── index.html           # HTML模板
├── package.json         # 依赖配置
├── tsconfig.json        # TypeScript配置
├── vite.config.ts       # Vite构建配置
├── tailwind.config.js   # Tailwind CSS配置
└── postcss.config.js    # PostCSS配置
```

## 技术栈说明

### 核心框架
- **React 18**: UI框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具（快速热更新）

### UI与样式
- **Tailwind CSS**: 原子化CSS框架
- **PostCSS**: CSS处理器

### 路由与状态
- **React Router**: 前端路由
- **localStorage**: 简单状态存储（Token、用户信息）

### HTTP请求
- **Axios**: HTTP客户端
  - 自动携带Token
  - 统一错误处理
  - 请求/响应拦截器

## 可用命令

```bash
# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# TypeScript类型检查
npm run type-check

# 代码格式化（如配置了Prettier）
npm run format

# 代码检查（如配置了ESLint）
npm run lint
```

## 页面路由

| 路径 | 页面 | 状态 | 权限 |
|------|------|------|------|
| `/` | 首页（重定向到/login） | ✅ | 公开 |
| `/login` | 登录页 | ✅ | 公开 |
| `/register` | 注册页 | ✅ | 公开 |
| `/student` | 学生端首页 | ⏳ | 学生 |
| `/student/qa` | 学生问答 | ⏳ | 学生 |
| `/student/survey` | 学生问卷 | ⏳ | 学生 |
| `/teacher` | 教师端首页 | ⏳ | 教师 |
| `/teacher/dashboard` | 教师看板 | ⏳ | 教师 |
| `/teacher/survey` | 问卷管理 | ⏳ | 教师 |

## 常见问题

### 1. 端口被占用

**错误**: `Port 3000 is already in use`

**解决方案**:
修改 `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 3001,  // 改为其他端口
  },
})
```

### 2. 依赖安装失败

**错误**: `npm ERR! code ENOTFOUND`

**解决方案**:
1. 检查网络连接
2. 使用国内镜像：
   ```bash
   npm config set registry https://registry.npmmirror.com
   ```
3. 清除缓存重试：
   ```bash
   npm cache clean --force
   npm install
   ```

### 3. CORS错误

**错误**: `Access to XMLHttpRequest blocked by CORS policy`

**检查清单**:
- ✅ 后端是否运行在 http://localhost:8000
- ✅ 后端CORS配置是否包含前端地址
- ✅ 浏览器开发者工具Network查看请求详情

**临时解决**:
在 `backend/app/main.py` 中添加前端地址到CORS白名单：
```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
]
```

### 4. Token过期

登录后过一段时间无法访问API，返回401错误。

**原因**: JWT Token过期（默认30分钟）

**解决方案**:
- 重新登录
- 或在 `backend/app/config/settings.py` 增加过期时间：
  ```python
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24小时
  ```

### 5. 样式不生效

**检查清单**:
- ✅ `index.css` 是否引入Tailwind指令
- ✅ `tailwind.config.js` 配置是否正确
- ✅ 浏览器开发者工具检查CSS是否加载

## 开发技巧

### 1. 查看API请求

打开浏览器开发者工具 → Network标签，筛选XHR请求，可以看到所有API调用。

### 2. 查看组件层级

安装React DevTools浏览器扩展，可查看组件树和状态。

### 3. 热更新失效

如遇热更新不工作：
1. 保存文件触发重新编译
2. 刷新浏览器
3. 重启dev服务器

### 4. TypeScript错误

如遇类型错误，可临时使用 `// @ts-ignore` 忽略，但建议修复类型定义。

## 生产部署

### 构建优化

```bash
npm run build
```

生成的 `dist/` 目录包含：
- 压缩的JavaScript
- 优化的CSS
- 静态资源

### 部署选项

1. **静态托管**（推荐）:
   - Vercel
   - Netlify
   - GitHub Pages
   - CloudFlare Pages

2. **传统服务器**:
   - Nginx配置示例：
     ```nginx
     server {
       listen 80;
       server_name your-domain.com;
       root /path/to/dist;
       
       location / {
         try_files $uri $uri/ /index.html;
       }
     }
     ```

3. **Docker容器**:
   ```dockerfile
   FROM nginx:alpine
   COPY dist/ /usr/share/nginx/html
   ```

### 环境变量

创建 `.env.production`:
```
VITE_API_URL=https://api.your-domain.com
```

代码中使用：
```typescript
const baseURL = import.meta.env.VITE_API_URL
```

## 联系与支持

如遇到问题，请查看项目根目录的README.md或提交Issue。
