# Social-Interaction-0620

扩列社交小程序 MVP 项目骨架。

## 文档
- `docs/PRD_v1.md`：MVP 需求清单、任务拆解、两周冲刺排期
- `docs/ENV_SETUP.md`：环境搭建步骤
- `docs/DESIGN_SYSTEM_V1.md`：设计系统规范（token、组件、动效）
- `backend/sql/init.sql`：MySQL 初始化脚本
- `backend/sql/admin_migration_001.sql`：管理后台字段迁移脚本

## 快速开始
```bash
docker compose up -d
cd backend
npm install
cp .env.example .env
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/init.sql
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/admin_migration_001.sql
npm run dev
```

## 目录
- `backend/`：Node.js + TypeScript API（已含 P0 主要接口）
- `miniprogram/`：微信小程序页面骨架，可直接导入开发者工具
- `admin-panel/`：举报处理与用户封禁管理页（静态页面）
