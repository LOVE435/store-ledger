#!/usr/bin/env bash
# 每日备份：数据库 + 上传图片，保留最近 14 份
# 建议加入 crontab： 0 3 * * * /root/store-ledger/deploy/backup.sh >> /var/log/ledger-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")"
STAMP="$(date +%F_%H%M)"
BACKUP_DIR="/var/backups/ledger"
DATA_DIR="./data"

mkdir -p "$BACKUP_DIR"

if [ ! -d "$DATA_DIR" ]; then
  echo "[$(date '+%F %T')] 无数据目录，跳过"
  exit 0
fi

tar -czf "$BACKUP_DIR/ledger-${STAMP}.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
# 只保留最近 14 份
ls -1t "$BACKUP_DIR"/ledger-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "[$(date '+%F %T')] 本地备份完成: $BACKUP_DIR/ledger-${STAMP}.tar.gz"

# 可选：同步到阿里云 OSS（异地双保险）。配置方法见 deploy/README.md
if [ -n "${OSS_BUCKET:-}" ] && command -v ossutil >/dev/null 2>&1; then
  ossutil cp -r "$BACKUP_DIR" "oss://${OSS_BUCKET}/ledger-backups/" --update >/dev/null
  echo "[$(date '+%F %T')] 已同步到 OSS: oss://${OSS_BUCKET}/ledger-backups/"
else
  echo "[$(date '+%F %T')] 未配置 ossutil/OSS_BUCKET，仅保留本地备份"
fi
