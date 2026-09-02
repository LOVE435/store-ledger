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

## 安全清单（已内置，上线即生效）

| 项目 | 状态 |
|---|---|
| **HTTPS 强制** | Caddy 自动签证书 + 80→443 跳转；安卓默认禁明文，正好兜住 |
| **3000 不对外** | compose 里 api-gateway 不映射任何宿主机端口，只有 Caddy 暴露 80/443 |
| **JWT_SECRET 强制** | 代码已改为：生产环境缺省或使用默认密钥时**拒绝启动**（密钥存于服务器 `deploy/.env`） |
| **防火墙** | 阿里云控制台只放行 `22/80/443`（务必不要开 3000） |
| **非 root 运行** | Dockerfile 已用 `USER node`（uid 1000），容器内不跑 root |
| **日志收敛** | 生产环境不再逐条打印 SQL；运行日志走 `docker logs`，不含密码/口令 |
| **每日备份** | `backup.sh`：本地保留 14 份 + 可选同步 OSS（异地双保险） |

### 异地备份到阿里云 OSS（推荐，一次配置）

```bash
# 1) 下载并配置 ossutil（用你的阿里云账号，支付宝即可）
curl https://gosspublic.alibaba.com/ossutil/install.sh | bash
ossutil config   # 按提示填 AccessKey ID/Secret、Endpoint(如 oss-cn-hongkong.aliyuncs.com)

# 2) 在 crontab 里加上 OSS_BUCKET 即可让 backup.sh 自动同步
# 先把下面这行加进 /root/.bashrc 或直接写进 crontab 行首：
#   OSS_BUCKET=你的bucket名
```

## 数据安全说明

- SQLite 数据库和上传图片放在服务器 `deploy/data/`（已 gitignore，不入代码库）
- 密钥只存在服务器 `deploy/.env`（gitignore，不提交，属主可再收紧为 600）
- 手机端默认禁止明文 HTTP：正式环境走 `https://` 域名，安全
- 建议阿里云控制台为实例开启**自动快照**（每周），配合每日备份双保险
