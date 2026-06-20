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
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/realtime_migration_004.sql
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/realtime_migration_005.sql
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/realtime_migration_006.sql
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

### 通知与推送
- `notification_preferences`
  - 用户通知配置总开关、私聊提醒开关、匹配提醒开关。
- `notification_tasks`
  - 离线通知任务队列，记录任务状态（`pending/processing/sent/failed/dead`）、重试计数与错误信息。
- `notification_callback_events`
  - 微信推送回调事件幂等入库表，按 `event_id` 去重。

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
- `backend/sql/realtime_migration_004.sql`
  - 增加通知设置表 `notification_preferences` 与通知任务表 `notification_tasks`。
- `backend/sql/realtime_migration_005.sql`
  - 为通知任务表补齐 `retry_count`、`max_retries`，用于指数退避重试与死信判定。
- `backend/sql/realtime_migration_006.sql`
  - 新增微信回调事件表 `notification_callback_events`，用于回调消息幂等落库。

## 5. 运维建议（MVP 阶段）
- 每次变更库结构时新增独立迁移文件，避免修改历史迁移。
- 生产环境通过 CI/CD 执行迁移，避免手工漏执行。
- 使用最小权限 DB 账号，避免在应用中使用 root。
