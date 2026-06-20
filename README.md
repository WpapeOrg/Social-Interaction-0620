# Social-Interaction-0620

扩列社交小程序 MVP 项目，包含小程序端、后端 API、举报处理后台页面。

## 当前已实现功能
- 用户登录：`/auth/wx-login` 微信 code 登录（开发阶段 mock code）。
- 用户资料：查询与更新个人资料、兴趣标签。
- 推荐与匹配：推荐列表、喜欢/跳过、互赞成匹配。
- 聊天：会话列表、消息查询与发送（文本）。
- 推送通知：支持通知偏好设置、离线通知任务入库、Worker 指数退避重试与死信状态。
- 安全能力：举报、拉黑、解除拉黑。
- 管理能力：举报列表、举报处理、用户封禁与解封。
- 小程序页面：登录、资料、推荐、会话、聊天、我的。

详细状态见 [功能实现清单](docs/IMPLEMENTED_FEATURES.md)。

## 快速开始
```bash
docker compose up -d
cd backend
npm install
cp .env.example .env
npm run dev
```

数据库初始化与迁移、管理台联调见 [环境搭建文档](docs/ENV_SETUP.md)。

## 项目结构
- `backend/`：Node.js + TypeScript API 与 SQL 脚本。
- `miniprogram/`：微信小程序页面与全局样式系统。
- `admin-panel/`：举报处理与用户状态管理页面（静态 HTML）。
- `docs/`：PRD、环境、API、数据库、设计系统、功能状态等文档。

## 文档索引
- [功能实现清单](docs/IMPLEMENTED_FEATURES.md)
- [产品路线图](docs/ROADMAP.md)
- [迭代执行计划（按周）](docs/ITERATION_PLAN.md)
- [环境搭建](docs/ENV_SETUP.md)
- [API 接口说明](docs/API.md)
- [数据库说明](docs/DATABASE.md)
- [管理后台使用说明](docs/ADMIN_PANEL.md)
- [设计系统](docs/DESIGN_SYSTEM_V1.md)
- [PRD v1](docs/PRD_v1.md)
