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
- 聊天页支持发送本地文本消息（当前为前端演示交互）。
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

### 2.4 安全能力
- `POST /reports`
- `POST /blocks`
- `DELETE /blocks/{blockedUserId}`

### 2.5 管理后台 API
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

## 5. 未实现功能（当前边界）

### 5.1 通信与在线能力
- 实时 IM（WebSocket）未接入，当前为 HTTP 拉取与发送。
- 消息已读回执、输入中状态、离线消息推送未实现。

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
