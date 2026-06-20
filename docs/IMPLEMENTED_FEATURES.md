# 功能实现清单

本文档用于记录当前仓库已落地的功能能力（以当前代码为准），便于需求对齐与验收。

## 1. 小程序端

### 1.1 已实现页面
- 登录页：`miniprogram/pages/login`
- 资料编辑页：`miniprogram/pages/profile/edit`
- 推荐页：`miniprogram/pages/recommend/list`
- 会话列表页：`miniprogram/pages/chat/list`
- 聊天详情页：`miniprogram/pages/chat/detail`
- 我的页：`miniprogram/pages/me/index`

### 1.2 已实现交互
- 登录获取 token 并本地保存。
- 推荐页拉取推荐列表，支持喜欢/跳过操作。
- 会话页接入后端会话列表与未读数显示。
- 聊天页接入会话消息拉取、消息发送、已读标记、输入中状态与快捷举报。
- 聊天页接入 WebSocket 重连策略（退避重连 + 心跳保活）与离线后增量补偿。
- 聊天页接入消息送达确认（delivery receipt）提示。
- 聊天页支持同账号多设备状态同步（消息、已读、送达）。
- 我的页新增“消息通知”开关，支持总开关/私聊提醒/匹配提醒保存。
- 后端新增通知任务消费 Worker，支持指数退避重试与死信状态。
- 推送通道已对接微信订阅消息真实发送，并提供回调签名校验接口。
- 微信回调已支持 AES 解密与幂等入库（防重复处理）。
- 微信回调事件可按 `provider_msg_id` 精确回写通知任务状态（sent/failed）。
- 全局深色霓虹风格设计系统与基础动效。

## 2. 后端 API（MVP）

### 2.1 用户与资料
- `POST /auth/wx-login`
- `GET /profile/me`
- `PUT /profile/me`

### 2.2 推荐与匹配
- `GET /recommendations`
- `POST /swipes`
- `GET /matches`

### 2.3 会话与消息
- `GET /conversations`
- `GET /conversations/{id}/messages`
- `POST /conversations/{id}/messages`
- `POST /conversations/{id}/read`

### 2.4 安全能力
- `POST /reports`
- `POST /blocks`
- `DELETE /blocks/{blockedUserId}`

### 2.5 通知能力
- `GET /notifications/settings`
- `PUT /notifications/settings`
- `GET /notifications/tasks`
- `PATCH /notifications/tasks/{id}`
- `GET /wechat/push/callback`
- `POST /wechat/push/callback`
- 通知任务 Worker：`backend/src/notification-worker.ts`
- 回调落库：`notification_callback_events`
- 回调状态回写：`notification_tasks.provider_msg_id`、`callback_status`、`callback_at`

### 2.6 管理后台 API
- `GET /admin/reports`
- `PATCH /admin/reports/{id}`
- `GET /admin/users`
- `PATCH /admin/users/{id}/status`

## 3. 管理后台页面
- 已提供静态管理页：`admin-panel/index.html`
- 支持：
  - 查询举报列表（按状态）
  - 处理举报（通过/驳回/封禁目标用户）
  - 搜索用户并执行封禁/解封

## 4. 数据库与基础设施
- Docker Compose 启动 MySQL + Redis。
- 已提供数据库初始化脚本与迁移脚本：
  - `backend/sql/init.sql`
  - `backend/sql/admin_migration_001.sql`
  - `backend/sql/realtime_migration_004.sql`
  - `backend/sql/realtime_migration_005.sql`
  - `backend/sql/realtime_migration_006.sql`
  - `backend/sql/realtime_migration_007.sql`

## 5. 未实现功能（当前边界）

### 5.1 通信与在线能力
- WebSocket 通道已接入，支持服务端主动下发新消息与已读回执。
- 输入中状态、送达回执已接入，离线推送任务支持数据库队列 + 微信订阅消息投递。

### 5.2 推荐与匹配能力
- 推荐策略仍为基础规则，未接入行为权重模型（活跃度、聊天成功率、偏好学习）。
- 卡片式滑动交互、重试推荐池、推荐去重策略未完善。

### 5.3 社交场景扩展
- 动态广场、话题圈子、语音破冰、群聊房间未实现。
- 同城活动报名与线下局场景未实现。

### 5.4 风控与治理
- 敏感词当前为基础能力，未接入第三方内容安全服务。
- 举报工单自动分发、分级审核、审核 SLA 监控未实现。

### 5.5 商业化与增长
- 会员权益、增值道具、任务体系、邀请裂变未实现。
- 埋点分析虽已预留，完整数据看板与漏斗分析未落地。

## 6. 后续新增功能方向（参考扩列小程序核心场景）

### 6.1 P1（优先补齐闭环）
- 实时聊天：WebSocket、已读状态、未读计数同步。
- 推荐体验：卡片滑动、快速破冰文案、推荐原因标签。
- 安全体验：一键举报入口优化、拉黑后全链路隔离。

### 6.2 P2（扩展社交深度）
- 语音破冰：3-5 分钟语音速配房。
- 动态广场：发布图文动态、评论点赞、兴趣话题流。
- 圈子场景：按兴趣进入小圈子，支持群聊与活动帖。

### 6.3 P3（增长与商业化）
- 会员体系：超级曝光、优先推荐、无限滑动等权益。
- 任务激励：新手任务、签到、邀请奖励。
- 运营平台：活动配置、审核看板、用户分层运营工具。
