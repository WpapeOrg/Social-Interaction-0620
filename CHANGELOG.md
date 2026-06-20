# CHANGELOG

## 2026-06-20

### Features
- **离线推送任务能力**：新增通知偏好接口与通知任务接口，消息发送后可按在线状态与用户偏好写入离线通知任务队列。
- **我的页通知设置**：新增“消息通知”设置卡片，支持总开关、私聊提醒、匹配提醒的读取与保存。
- **数据库迁移补齐**：新增 `backend/sql/realtime_migration_004.sql`，为历史库补齐通知配置表与通知任务表。
- **通知 Worker 重试机制**：新增通知任务消费 Worker，支持指数退避重试、处理中状态与死信状态（`dead`）。
- **通知任务结构升级**：新增 `backend/sql/realtime_migration_005.sql`，补齐 `retry_count`、`max_retries` 字段。
- **微信订阅消息真实投递**：新增微信推送适配器，任务消费从 mock 切换为可配置的微信订阅消息发送。
- **回调签名校验接口**：新增 `/wechat/push/callback` GET/POST 接口并校验微信 `signature`。
- **回调安全模式增强**：新增 `msg_signature` 校验与 AES 解密，支持微信安全模式回调处理。
- **回调幂等入库**：新增 `notification_callback_events` 表，按 `event_id` 去重保存回调消息。
- **回调状态同步**：按微信回调 `MsgID` 回写 `notification_tasks` 状态（`sent/failed`）并记录 `callback_status` 与回调时间。
- **推送任务通道标识落库**：发送成功后记录 `provider_msg_id`、`provider_trace_id`，用于后续回调精确匹配。

### Documentation
- **文档结构重构**：将 README 调整为项目入口，新增并拆分详细文档到 `docs/`，避免重复内容。
- **新增专题文档**：新增 `docs/API.md`、`docs/DATABASE.md`、`docs/ADMIN_PANEL.md`、`docs/IMPLEMENTED_FEATURES.md`。
- **README 内容优化**：增加“当前已实现功能”概览与文档索引，快速定位安装、API、数据库与后台说明。
- **现有文档补充对齐**：更新 `docs/ENV_SETUP.md`、`docs/PRD_v1.md`、`docs/DESIGN_SYSTEM_V1.md`，统一文档职责与引用关系。
- **未实现与路线图补充**：补充未实现功能边界，并新增 `docs/ROADMAP.md` 记录后续阶段功能规划。
- **新增迭代任务拆解**：新增 `docs/ITERATION_PLAN.md`，按周拆解页面、API、数据库、测试与验收标准。
- **文档技能规则补充**：`markdown-docs-optimizer` 新增“每次提交前补充 CHANGELOG 变更记录”要求。
- **分支技能规则补充**：`commit-flow-enforcer` 新增“相近需求迭代复用原分支，不重复创建分支”规则。
- **Node/npm 推荐版本补充**：在 `README.md` 与 `docs/ENV_SETUP.md` 增加推荐版本（Node 20 LTS + npm 10）及 `npm 11.13.0` 报错排查指引。
- **Node/npm 版本收敛**：将推荐版本明确为 `Node.js 20.19.x + npm 10.9.2`，并在 `backend/package.json` 增加 `engines` 约束。
- **版本对齐文件补充**：新增根目录 `.nvmrc`（`20.19.0`）与 `.npmrc`（`engine-strict=true`），并在环境文档补充对齐使用方式。
- **镜像源替换**：将 `backend/package-lock.json` 的依赖下载源从 `registry.m.jd.com` 统一替换为 `registry.npmmirror.com`。
- **版本维护分支约定**：新增 `feature/version-maintenance` 作为后续 Node/npm/镜像源相关改动的统一迭代分支。
