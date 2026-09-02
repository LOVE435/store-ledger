# API Gateway 接口文档

记账本（store-ledger）后端接口。基础地址：`http://localhost:3000`。
技术栈：Node.js + TypeScript + Express + SQLite（内置 `node:sqlite`）+ Socket.IO。

## 账号体系：/api/auth

### POST /api/auth/register

注册新账号（一个账号 = 一家店 = 一本账）。body: `{ username, password }`。

- 用户名：2-30 位字母、数字、下划线、连字符或中文；密码至少 6 位。
- 成功 `201` → `{ token, user: { id, username, createdAt } }`；用户名重复 `409`。

### POST /api/auth/login

登录。body: `{ username, password }` → `200` 同上；用户名或密码错误 `401`。

> 同一账号可在多台设备同时登录：每台设备各持一个 token，互不挤占，数据共享。

### GET /api/auth/me

需 `Authorization: Bearer <token>` → 当前登录用户。

## 业务数据：/api/ledger

一账号一店一账本，所有数据按 owner（账号）隔离。实体类型 `entity`：`client`（客户）、`record`（账目）。
data 为前端完整对象，字段按白名单保存（Client: name/location/wechatId/phone...；Record: 全部 20+ 字段含 noteImages/printImages 图片数组）。

### GET /api/ledger/:entity

需登录。拉取本账号该实体全部数据（含墓碑软删行，带 `_meta`）。

- 响应：`{ entity, items: [...], maxUpdatedAt, full: true }`
- 每项形如 `{ id, ...前端字段, _meta: { ownerId, entity, createdAt, updatedAt, deletedAt } }`

### GET /api/ledger/:entity?since=ISO

增量拉取：只返回 `updated_at > since` 的行（用于多设备增量同步，返回 `full: false`）。

### PUT /api/ledger/:entity/:id

upsert 单行。body 为前端完整对象（`id` 必须与路径一致）。同 owner + id 重复提交即覆盖。

### DELETE /api/ledger/:entity/:id

软删除：写 `deleted_at` 墓碑，增量拉取时其它设备能收到该删除。

## 批量同步：/api/sync

供前端多设备增量同步（当前 App 使用此通道）。均需登录。

### POST /api/sync/push

批量上行（LWW 冲突处理）。body：

```json
{
  "items": [
    { "entity": "client|record", "id": "...", "updatedAt": "ISO时间", "deletedAt": "ISO|null", "data": { "...完整前端对象" } }
  ]
}
```

返回每项处理结果：

```json
{ "results": [ { "entity": "...", "id": "...", "applied": true|false, "server": { ... } } ] }
```

- `applied: true` → 服务端已接受该版本。
- `applied: false` → **冲突**：服务端已有更新版本，`server` 字段回传服务端较新的行，客户端应据此合并（保留 `server` 或提示用户）。规则：`updated_at` 较大者胜（LWW）。

软删除同样走 push：`deletedAt` 非空 + 更新的 `updatedAt` 即墓碑，其它设备 pull 时收到并本地软删。

### POST /api/sync/pull

批量下行（增量）。body：`{ clientSince?, recordSince? }`（ISO 时间，缺省 = 全量）。返回：

```json
{
  "client": { "items": [...], "maxUpdatedAt": "..." },
  "record": { "items": [...], "maxUpdatedAt": "..." }
}
```

客户端保存各实体 `maxUpdatedAt` 作为下次 `since` 游标；`items` 含墓碑行（`_meta.deletedAt` 非空）。

## 图片上传：/api/images

需登录。图片以 dataURL 上传，服务端落盘并返回 URL（App 数据里存 URL 而非 base64，多设备同步轻量）。

### POST /api/images

body：`{ "dataUrl": "data:image/jpeg;base64,..." }`（支持 jpeg/png/webp/gif，单图 ≤15MB）。

- `201` → `{ url: "/uploads/<uuid>.jpg", mime, size }`
- 静态访问：`GET /uploads/<name>`（服务端托管，无需鉴权）。

## 实时推送（WebSocket / Socket.IO）

WebSocket 地址与 HTTP 同端口（`ws://localhost:3000`），握手带 `{ auth: { token } }`，token 有效则加入该账号房间。

| 事件 | 触发时机 | 数据 |
| --- | --- | --- |
| `sync-changed` | `/api/sync/push` 批量成功后 | `{ count }` |
| `ledger-update` | `/api/ledger` upsert/删除后 | `{ entity, action: upsert\|delete, id, updatedAt, deletedAt }` |

前端订阅示例：

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000', { auth: { token } });
socket.on('sync-changed', () => { /* 触发增量拉取 */ });
```

## 通用约定

- 认证：除 `/health` 外，受保护接口需在请求头携带 `Authorization: Bearer <token>`（JWT）。
- 响应格式（统一）：
  ```json
  { "status": "success|error", "message": "...", "data": ... }
  ```
- 错误码：`401` 未认证、`404` 资源不存在、`409` 冲突、`500` 服务器内部错误。

## 健康检查

### GET /health

返回服务运行状态与当前时间。

```json
{ "status": "OK", "timestamp": "2026-08-29T08:30:00.000Z" }
```

## 数据模型（SQLite）

- `users`：账号（id, username, password_hash, created_at）
- `ledger_items`：多用户业务数据（owner_id, entity, id, data JSON, updated_at, deleted_at），主键 `(owner_id, entity, id)`

## 测试 / 构建

```bash
npm test        # 运行全部测试（Jest，内存 SQLite）
npm run build   # TypeScript 编译到 dist/
npm run dev     # 开发模式（nodemon + ts-node）
```
