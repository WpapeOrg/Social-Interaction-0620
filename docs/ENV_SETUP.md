# 环境搭建说明（MVP）

## 1. 依赖版本
- Node.js >= 20
- npm >= 10
- Docker Desktop >= 4.x
- 微信开发者工具（最新版）

## 2. 启动基础服务（MySQL + Redis）
在项目根目录执行：

```bash
docker compose up -d
```

检查服务状态：

```bash
docker compose ps
```

如果本机没有 Docker，可手动准备本地 MySQL 8 和 Redis 7，并按 `backend/.env.example` 配置连接。

## 3. 启动后端 API
进入后端目录并安装依赖：

```bash
cd backend
npm install
cp .env.example .env
```

初始化数据库表：

```bash
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/init.sql
mysql -h 127.0.0.1 -P 3306 -u social_user -psocial_pass social_interaction < sql/admin_migration_001.sql
```

启动开发服务：

```bash
npm run dev
```

健康检查：

```bash
curl http://localhost:3000/health
```

## 3.1 管理后台（举报处理）联调
- 后端管理接口鉴权 Header：`x-admin-key`
- 默认值（未配置时）：`dev_admin_key`
- 推荐在 `backend/.env` 设置：

```bash
ADMIN_API_KEY=replace_with_admin_key
```

可直接打开管理页：
- `admin-panel/index.html`
- 填写 `API Base` 和 `Admin Key` 后，可进行举报处理、用户封禁/解封

## 4. 小程序端建议目录（手动创建）
当前仓库已提供 `miniprogram/` 初始骨架，可直接在微信开发者工具导入该目录。

建议最小页面结构：
- pages/login
- pages/profile/edit
- pages/recommend/list
- pages/chat/list
- pages/chat/detail
- pages/me/index

## 5. 推荐后续步骤
- 接入 ORM（Prisma/TypeORM）并创建库表迁移。
- 落地 `PRD_v1.md` 中的 API 清单。
- 增加基础测试（鉴权、匹配、消息接口）。
