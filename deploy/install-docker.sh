#!/usr/bin/env bash
# 在 Ubuntu 22.04/24.04 上安装 Docker Engine + Compose 插件
set -euo pipefail

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker + Compose 已安装，跳过"
  exit 0
fi

# 官方一键脚本（会安装 docker + compose 插件）
curl -fsSL https://get.docker.com | sh

systemctl enable --now docker
echo "Docker 安装完成："
docker --version
docker compose version
