# 记账本（store-ledger）

面向线下店铺的记账 Android App（多设备云同步版）。
一个账号 = 一家店 = 一本账；同一账号可在多台手机同时登录，数据实时互通；不同账号（店）互相隔离。

## 功能

- 账号体系：用户名/密码注册登录，JWT 鉴权（后端 `api-gateway/`）
- 云同步：同账号多设备自动双向增量同步（LWW 冲突处理 + 软删除墓碑），WebSocket 实时推送
- 图片：拍照存证随账目上传服务器，多设备可见
- 客户列表：客户名（唯一）/所在地/微信号/手机号，可增删改；微信号可一键跳转微信聊天（失败有兜底）
- 记账：客户名下拉联想（自动带出所在地）、产品联想、总价自动计算、备货进度（未备货红/已备货绿）
- 客户名校验：客户不存在时提醒，可自动建客户并保存订单
- 账目列表：日期倒序 + 按客户/产品/备货状态/时间段筛选，未备货笔数提醒
- 排行：订单排行（按笔数/金额）、近期采购排行
- 客户分析：按所在地分组，文字介绍 + 近 12 个月金额柱状图 + 产品占比饼图 + 按时间查看采购记录
- 设置：账号信息/退出登录/手动同步；导出 CSV / JSON 备份，导入 JSON 恢复

## 架构

```
手机 App (React + Dexie 本地库)  ←HTTPS/WS→  api-gateway (Node/Express + SQLite + JWT)
```

- 本地先写 IndexedDB（离线可用），后台自动同步；`src/lib/cloud.ts` API 客户端、`src/lib/sync.ts` 同步引擎
- 后端：`api-gateway/`，`users` 表 + `ledger_items`（owner 隔离、data JSON 存前端全字段、updated_at 游标、deleted_at 墓碑）
- 接口：`POST /api/auth/{register,login}`、`GET /api/auth/me`、`POST /api/sync/{push,pull}`、`POST /api/images`
- 详见 [api-gateway/docs/API.md](api-gateway/docs/API.md)

## 开发（本地联调）

先启动后端（端口 3000）：

```bash
cd api-gateway
npm install
npm run dev        # 或 npm run build && npm start
```

再启动前端（端口 5173）：

```bash
npm install
npm run dev        # 浏览器打开 http://localhost:5173
```

浏览器里第一次进入是登录页：注册一个账号（=一家店），登录后即自动同步。
多设备模拟：开两个浏览器窗口/隐身窗口，登录**同一账号**，一边记账另一边几秒内自动出现。

手机真机联调：后端地址在**构建时**通过 `VITE_API_URL` 固定（登录页/设置页不再提供填写），
打包前用 `VITE_API_URL=http://192.168.x.x:3000 npm run build` 指向电脑局域网 IP；
需手机与电脑同一 Wi-Fi，且后端启动时监听 0.0.0.0（Express 默认全接口）。
本地开发不设置时默认 `http://localhost:3000`。环境变量说明见 `.env.example`。

```bash
npm test           # 单元测试
npm run build      # 前端构建
```

## 打包 APK

需要 Android SDK（`ANDROID_HOME`）。签名密钥放在 `android/keystore/`（已 gitignore），
`android/app/build.gradle` 中引用 release 签名配置。产物在 `android/app/build/outputs/apk/release/`。

上线前：把前端/后端部署到公网服务器并配 HTTPS（Android 默认禁止明文 HTTP），
服务器地址指向 `https://你的域名`。
