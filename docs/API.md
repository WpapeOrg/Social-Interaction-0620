# API 接口说明

本文档描述当前后端 API 的可用接口、鉴权方式和核心请求参数。

## 基础信息
- Base URL：`http://localhost:3000`
- 数据格式：`application/json`
- 用户鉴权 Header：`Authorization: Bearer <your-token>`
- 管理鉴权 Header：`x-admin-key: <your-admin-key>`
- WebSocket：`ws://localhost:3000/ws?token=<url-encoded-bearer-token>`
- WebSocket 客户端事件：
  - `typing`：上报输入中状态 `{ type, conversationId, isTyping }`
  - `ping`：连接保活

## 健康检查

### `GET /health`
- 鉴权：否
- 说明：服务存活检查。

## 1. 认证与用户资料

### `POST /auth/wx-login`
- 鉴权：否
- 请求体：
```json
{
  "code": "mock_or_real_wechat_code"
}
```
- 返回：`token` 与 `userId`。

### `GET /profile/me`
- 鉴权：用户鉴权
- 返回当前登录用户资料。

### `PUT /profile/me`
- 鉴权：用户鉴权
- 请求体（字段可选）：
```json
{
  "nickname": "Alice",
  "avatar": "https://example.com/a.png",
  "gender": "female",
  "ageRange": "18-24",
  "city": "上海",
  "bio": "爱羽毛球",
  "tags": ["运动", "摄影", "旅行"]
}
```

## 2. 推荐与匹配

### `GET /recommendations`
- 鉴权：用户鉴权
- 返回推荐用户列表（排除已划动、拉黑关系、封禁用户）。

### `POST /swipes`
- 鉴权：用户鉴权
- 请求体：
```json
{
  "targetUserId": 2,
  "action": "like"
}
```
- `action` 取值：`like` / `pass`
- 返回：
```json
{
  "data": {
    "matched": true
  }
}
```

### `GET /matches`
- 鉴权：用户鉴权
- 返回当前用户所有 `active` 匹配记录。

## 3. 会话与消息

### `GET /conversations`
- 鉴权：用户鉴权
- 返回当前用户可访问会话列表，含 `unread_count` 未读数量。

### `GET /conversations/{id}/messages`
- 鉴权：用户鉴权
- 返回指定会话消息（最多 200 条）。

### `POST /conversations/{id}/messages`
- 鉴权：用户鉴权
- 请求体：
```json
{
  "content": "你好，认识一下"
}
```

### `POST /conversations/{id}/read`
- 鉴权：用户鉴权
- 请求体（可选）：
```json
{
  "lastReadMessageId": 123
}
```
- 说明：未传时默认标记该会话当前最新消息为已读。

## 4. 安全与关系

### `POST /reports`
- 鉴权：用户鉴权
- 请求体：
```json
{
  "targetUserId": 2,
  "targetMessageId": 1,
  "reason": "不友好内容"
}
```

### `POST /blocks`
- 鉴权：用户鉴权
- 请求体：
```json
{
  "blockedUserId": 2
}
```

### `DELETE /blocks/{blockedUserId}`
- 鉴权：用户鉴权
- 解除拉黑关系。

## 5. 管理后台接口

### `GET /admin/reports`
- 鉴权：管理鉴权
- Query 参数：
  - `status`：`pending` / `processed` / `rejected`
  - `page`：默认 1
  - `pageSize`：默认 20，最大 100

### `PATCH /admin/reports/{id}`
- 鉴权：管理鉴权
- 请求体：
```json
{
  "status": "processed",
  "action": "ban_target",
  "note": "确认违规",
  "reviewedBy": "admin-ui"
}
```
- `status`：`processed` / `rejected`
- `action`：`none` / `ban_target` / `ban_reporter`

### `GET /admin/users`
- 鉴权：管理鉴权
- Query 参数：
  - `keyword`：按昵称或城市搜索。

### `PATCH /admin/users/{id}/status`
- 鉴权：管理鉴权
- 请求体：
```json
{
  "status": "banned"
}
```
- `status`：`active` / `banned`

## 6. 常见错误码
- `400`：参数错误。
- `401`：未登录或管理 Key 错误。
- `403`：无权限访问目标会话。
- `404`：目标资源不存在。
- `500`：服务内部错误。

## 7. WebSocket 下行事件
- `connected`：连接建立成功。
- `new_message`：新消息推送。
- `read_receipt`：对方已读回执。
- `typing_status`：对方输入状态变化。
- `pong`：服务端心跳应答。
