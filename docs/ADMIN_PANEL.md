# 管理后台使用说明

本文档描述 `admin-panel` 的使用方式与管理 API 对接规则。

## 1. 功能概览
- 按状态查看举报列表（`pending` / `processed` / `rejected`）。
- 处理举报：通过、驳回、封禁被举报用户。
- 用户管理：搜索用户并执行封禁/解封。

## 2. 启动前提
- 后端 API 正常运行：`http://localhost:3000`
- 已配置管理密钥：`ADMIN_API_KEY`
- 管理页文件：`admin-panel/index.html`

## 3. 使用步骤
1. 浏览器打开 `admin-panel/index.html`。
2. 输入：
   - `API Base`：例如 `http://localhost:3000`
   - `Admin Key`：与后端 `ADMIN_API_KEY` 一致
3. 点击“加载举报”或“加载用户”。

## 4. 对应后端接口
- `GET /admin/reports`
- `PATCH /admin/reports/{id}`
- `GET /admin/users`
- `PATCH /admin/users/{id}/status`

详细字段见 [API 接口说明](API.md)。

## 5. 安全建议
- 不要在前端硬编码管理 Key。
- 生产环境建议将管理页部署在受限网络或加一层登录鉴权。
- 管理操作应有审计日志（MVP 当前仅保留基础处理记录字段）。
