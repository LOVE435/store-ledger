# api-gateway（记账本后端）

记账本 App（多设备云同步版）的同步后端。技术栈：Node.js（≥22，使用内置 `node:sqlite`）+ TypeScript + Express + Socket.IO，零外部服务依赖（SQLite 单文件持久化）。

## 快速开始

```bash
npm install
npm run dev        # 开发模式（nodemon + ts-node），监听 3000
# 或
npm run build && npm start
```

首次启动自动创建 `./data/store-ledger.db` 与表结构。启动后访问 `http://localhost:3000/health` 验证。

## 测试与构建

```bash
npm test          # Jest，测试用内存 SQLite
npm run build     # tsc 编译到 dist/
```

## 接口

- 认证：`POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`
- 业务数据：`/api/ledger`（按账号隔离的 REST 读写）
- 多设备批量同步：`POST /api/sync/push`、`POST /api/sync/pull`
- 图片上传：`POST /api/images`（静态访问 `/uploads/<name>`）
- 实时推送：WebSocket（与 HTTP 同端口），事件 `sync-changed` / `ledger-update`
- 健康检查：`GET /health`

完整接口约定见 [docs/API.md](docs/API.md)。

## Docker 部署

```bash
docker compose up -d     # 构建镜像并启动 api-gateway（3000）
```

SQLite 数据通过 `sqlite-data` volume 持久化。生产环境务必通过环境变量设置 `JWT_SECRET`。

## 环境变量

见 [.env.example](.env.example)：`PORT` / `NODE_ENV` / `DATABASE_FILE` / `JWT_SECRET`。
