# 周计划管理系统

基于 React + TypeScript + TailwindCSS 的周计划管理系统前端。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS v4
- **路由**: React Router v7
- **状态管理**: Zustand
- **数据请求**: TanStack Query (React Query)
- **动画**: Framer Motion
- **日期处理**: Day.js
- **图标**: Lucide React

## 功能模块

### 用户端
- 个人周计划管理
- 团队计划大板查看
- 按周查看和切换
- 计划搜索

### 管理员
- 用户管理
- 项目管理
- 计划分配

## 开发运行

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
src/
├── components/          # 组件
│   ├── layout/         # 布局组件
│   ├── PlanCard.tsx    # 计划卡片
│   ├── PlanModal.tsx   # 计划弹窗
│   └── WeekSelector.tsx # 周选择器
├── pages/              # 页面
│   ├── LoginPage.tsx
│   ├── PersonalPage.tsx
│   ├── BoardPage.tsx
│   ├── UserManagementPage.tsx
│   └── ProjectManagementPage.tsx
├── services/           # API 服务
│   └── api.ts
├── store/             # 状态管理
│   ├── authStore.ts
│   └── weekStore.ts
├── types/             # 类型定义
│   └── index.ts
├── lib/               # 工具函数
│   └── utils.ts
├── App.tsx            # 根组件
├── main.tsx           # 入口文件
└── index.css          # 全局样式
```

## 设计系统

### 色彩
- 深色基底: `#05070C` ~ `#1E2636` (五层渐变)
- 强调色: `#38BDF8` (淡蓝)
- 文本: `#E5E7EB` / `#9CA3AF`

### 组件风格
- 圆角: 全圆角按钮 (`999px`), 卡片圆角 (`0.75rem`)
- 动画: 流畅的渐入渐出 (300ms)
- 间距: Token 化设计，保持统一节奏

## 后端接口约定

请参考 `/docs/API.md` 了解完整的 API 接口定义。

### 基础路径
```
http://localhost:8080/api
```

### 主要端点
- `POST /auth/login` - 登录
- `POST /auth/register` - 注册
- `GET /plans/my/:year/:week` - 获取个人计划
- `GET /plans/week/:year/:week` - 获取团队计划
- `GET /users` - 获取用户列表
- `GET /projects` - 获取项目列表

## License

MIT
