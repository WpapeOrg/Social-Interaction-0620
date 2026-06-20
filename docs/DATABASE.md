# 数据库说明

本文档说明当前项目数据库依赖、初始化方式、核心表结构与迁移脚本。

## 1. 依赖
- MySQL 8.0
- Redis 7（当前主要用于预留缓存能力）

## 2. 初始化与迁移

在项目根目录启动容器后执行：

```bash
cd backend
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/init.sql
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/admin_migration_001.sql
```

## 3. 核心表

### 用户与标签
- `users`
- `tags`
- `user_tags`

### 匹配与关系
- `swipes`
- `matches`
- `blocks`

### 会话与消息
- `conversations`
- `messages`
- `message_reads`
- `message_deliveries`

### 举报与审核
- `reports`
  - 包含 `status`、`review_note`、`reviewed_by`、`reviewed_at` 等处理字段。

## 4. 脚本说明
- `backend/sql/init.sql`
  - 首次建表脚本，覆盖用户、匹配、消息、举报等核心表。
- `backend/sql/admin_migration_001.sql`
  - 为历史库补齐举报审核字段（幂等迁移写法）。
- `backend/sql/realtime_migration_002.sql`
  - 增加消息已读状态表 `message_reads`（用于未读计数与已读回执）。
- `backend/sql/realtime_migration_003.sql`
  - 增加消息送达状态表 `message_deliveries`（用于送达确认）。

## 5. 运维建议（MVP 阶段）
- 每次变更库结构时新增独立迁移文件，避免修改历史迁移。
- 生产环境通过 CI/CD 执行迁移，避免手工漏执行。
- 使用最小权限 DB 账号，避免在应用中使用 root。
