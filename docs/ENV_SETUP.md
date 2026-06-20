# 环境搭建

本文档用于快速拉起本地开发环境（Docker + 后端 API + 小程序导入）。

## 1. 前置依赖
- Node.js >= 20
- npm >= 10
- Docker Desktop >= 4.x
- 微信开发者工具

## 2. 启动基础服务

项目根目录执行：

```bash
docker compose up -d
docker compose ps
```

## 3. 启动后端服务

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

健康检查：

```bash
curl http://localhost:3000/health
```

## 4. 初始化数据库

数据库初始化与迁移请按 [数据库说明](DATABASE.md) 执行。

实时聊天升级后，需额外执行：

```bash
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/realtime_migration_002.sql
```

## 5. 管理后台联调

管理页说明请见 [管理后台使用说明](ADMIN_PANEL.md)。

## 6. 小程序导入
- 小程序目录：`miniprogram/`
- 在微信开发者工具中导入该目录即可。

页面列表：
- `pages/login`
- `pages/profile/edit`
- `pages/recommend/list`
- `pages/chat/list`
- `pages/chat/detail`
- `pages/me/index`
