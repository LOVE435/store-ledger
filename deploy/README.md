# 阿里云香港节点 · 生产部署手册

把记账本后端部署到你的阿里云轻量服务器（香港节点），一条命令启动，Caddy 自动配 HTTPS。

## 0. 你需要先有

| 东西 | 说明 |
|---|---|
| 阿里云轻量服务器（香港） | 建议 2核2G，系统 **Ubuntu 22.04** |
| 一个域名 | 例：`jz.xxx.top`（.top/.xyz 首年很便宜；香港节点免备案） |
| 域名解析 | 在域名控制台加一条 **A 记录** → 服务器**公网 IP**（记录名用 `@` 或 `api`，与下面 DOMAIN 对应） |

> 香港节点**不需要** ICP 备案；大陆节点必须备案后才能用域名访问。

## 1. 付款后第一步：开防火墙

阿里云控制台 → 轻量应用服务器 → 你的实例 → **防火墙** → 添加规则放行：
`22`（SSH）、`80`、`443`。

⚠️ **不要放行 3000**：后端只在 Docker 内网里被 Caddy 访问。

## 2. 登录服务器

用阿里云控制台的「远程连接」（Workbench 网页版）最省事，不需要装软件。
登录后执行下面命令（把项目克隆到服务器）：

```bash
git clone https://github.com/LOVE435/store-ledger.git
cd store-ledger/deploy
```

## 3. 安装 Docker（只需一次）

```bash
bash install-docker.sh
```

## 4. 一键启动（填你的域名 + 随机密钥）

```bash
DOMAIN=jz.你的域名.top JWT_SECRET=一串很长的随机字符 bash start.sh
```

- 首次会构建镜像 + 拉 Caddy，约 2-5 分钟
- Caddy 会自动向 Let's Encrypt 申请 HTTPS 证书并**自动续期**，无需手动管

## 5. 验证

浏览器打开：

```
https://jz.你的域名.top/health
```

看到 `{"status":"OK", ...}` 即部署成功 ✅

## 6. 开启每日自动备份

```bash
crontab -e
# 粘贴这一行（保存退出）：
0 3 * * * /root/store-ledger/deploy/backup.sh >> /var/log/ledger-backup.log 2>&1
```

备份文件存在服务器 `/var/backups/ledger/`（保留 14 份）。**建议再加一步**：把备份目录同步到阿里云 OSS 做异地备份（需要时可再配）。

## 7. 手机 App 指向你的域名

在**你自己电脑**上（不是服务器）重新打包 APK：

```bash
cd C:\dev\store-ledger
$env:VITE_API_URL="https://jz.你的域名.top"
npm run build
npx cap sync android
# 然后用 Android Studio 或 gradlew 打 APK，装到家人手机上
```

## 8. 日常维护（几乎为零）

- 崩溃自动重启（compose 已配 `restart: unless-stopped`）
- 证书自动续期（Caddy）
- 数据每天自动备份（第 6 步）
- 升级代码：服务器上 `cd store-ledger && git pull && cd deploy && DOMAIN=... JWT_SECRET=... bash start.sh`
- 阿里云控制台给实例开「自动快照」（每周），出事一键回滚
- 系统安全更新：偶尔执行 `sudo apt update && sudo apt upgrade -y`

## 数据安全说明

- SQLite 数据库和上传图片放在服务器 `deploy/data/`（已 gitignore，不入代码库）
- 密钥只存在服务器 `deploy/.env`（gitignore，不提交）
- 手机端默认禁止明文 HTTP：正式环境走 `https://` 域名，安全
