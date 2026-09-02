#!/usr/bin/env bash
# 一键启动生产环境（api-gateway + Caddy HTTPS）
# 用法：
#   DOMAIN=jz.你的域名.top JWT_SECRET=一串随机字符 bash start.sh
# 说明：DOMAIN 的 DNS(A 记录) 必须已解析到本机公网 IP；Caddy 会自动申请/续期证书。
set -euo pipefail

cd "$(dirname "$0")"

: "${DOMAIN:?请设置 DOMAIN，例如 DOMAIN=jz.example.top}"
: "${JWT_SECRET:?请设置 JWT_SECRET（一串随机长字符串）}"

if [ ! -f .env ]; then
  # 把变量持久化到 deploy/.env（compose 会自动读取），避免每次手输
  cat > .env <<EOF
DOMAIN=${DOMAIN}
JWT_SECRET=${JWT_SECRET}
EOF
  echo "已写入 deploy/.env"
fi

echo "==> 拉取镜像并构建后端 ..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "部署完成。等待约 1-2 分钟让 Caddy 签发证书，然后访问："
echo "  https://${DOMAIN}/health"
echo "看到 {\"status\":\"OK\"...} 即成功。"
