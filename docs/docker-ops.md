---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 968dc0c393bc6e2852b52f6c0f829664_72e101736ce811f1a99c5254007bceed
    ReservedCode1: oMm7YtHnemezinywLqt0DtRFbIk0k/wuWWqa46CIfhlxLDnp9BA4yJNtYfAqJ58cpyBCehhrZp1slgUPJXrMDZyqOAONwrDd38RDSTOFsJTi+OaNQ5pbmuSCDXYn5MFVtI+q8W+3RJlijJ7qwPcgmTSPBESgjcgSWiePuWb67YWGEZgeI018+tBK6/k=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 968dc0c393bc6e2852b52f6c0f829664_72e101736ce811f1a99c5254007bceed
    ReservedCode2: oMm7YtHnemezinywLqt0DtRFbIk0k/wuWWqa46CIfhlxLDnp9BA4yJNtYfAqJ58cpyBCehhrZp1slgUPJXrMDZyqOAONwrDd38RDSTOFsJTi+OaNQ5pbmuSCDXYn5MFVtI+q8W+3RJlijJ7qwPcgmTSPBESgjcgSWiePuWb67YWGEZgeI018+tBK6/k=
---

# Docker 运维常用命令

> 项目：Social-Interaction-0620

## 容器状态

| 操作 | 命令 |
|------|------|
| 查看运行中容器 | `docker ps` |
| 查看所有容器（含停止） | `docker ps -a` |
| 查看容器资源占用 | `docker stats` |

## 环境变量查询

| 操作 | 命令 |
|------|------|
| 查看 app 容器全部环境变量 | `docker exec social-interaction-0620-app-1 printenv` |
| 查 ADMIN_API_KEY | `docker exec social-interaction-0620-app-1 printenv ADMIN_API_KEY` |
| 查 DB_PASSWORD | `docker exec social-interaction-0620-app-1 printenv DB_PASSWORD` |
| 查 JWT_SECRET | `docker exec social-interaction-0620-app-1 printenv JWT_SECRET` |

## 日志

| 操作 | 命令 |
|------|------|
| 查看 app 日志 | `docker logs social-interaction-0620-app-1` |
| 实时跟踪 app 日志 | `docker logs -f social-interaction-0620-app-1` |
| 查看 MySQL 日志 | `docker logs social_mysql` |
| 查看 Redis 日志 | `docker logs social_redis` |

## 进入容器

| 操作 | 命令 |
|------|------|
| 进入 app 容器终端 | `docker exec -it social-interaction-0620-app-1 sh` |
| 进入 MySQL 终端 | `docker exec -it social_mysql mysql -u root -p` |

## 启动 / 停止 / 重启

| 操作 | 命令 |
|------|------|
| 重建并启动 | `docker compose down && docker compose up -d` |
| 重新构建镜像启动 | `docker compose up -d --build` |
| 停止 | `docker compose down` |
| 重启 | `docker compose restart` |

## 容器信息

| 操作 | 命令 |
|------|------|
| 查看端口映射 | `docker port social-interaction-0620-app-1` |
| 查看容器详情 | `docker inspect social-interaction-0620-app-1` |

## 项目环境变量说明

| 变量名 | 含义 |
|--------|------|
| ADMIN_API_KEY | 后台管理界面登录密钥 |
| JWT_SECRET | 用户登录 Token 签名密钥 |
| DB_HOST | MySQL 数据库地址 |
| DB_PORT | MySQL 端口 |
| DB_NAME | 数据库名 |
| DB_USER | 数据库用户名 |
| DB_PASSWORD | 数据库密码 |
| REDIS_HOST | Redis 地址 |
| REDIS_PORT | Redis 端口 |
| NODE_ENV | 运行环境（development / production） |
| PORT | 应用端口 |
*（内容由AI生成，仅供参考）*
