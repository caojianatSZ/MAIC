#!/bin/bash
set -e

cd /opt/openmaic

echo "[Deploy] Pulling latest code..."
git pull origin main

echo "[Deploy] Installing dependencies..."
pnpm install --silent

echo "[Deploy] Pushing database schema..."
pnpm prisma db push --skip-generate

# 清理构建缓存和锁文件，防止构建冲突
echo "[Deploy] Cleaning build cache..."
rm -rf .next

echo "[Deploy] Building..."
pnpm build

echo "[Deploy] Restarting PM2..."
pm2 restart openmaic-web

echo "[Deploy] Done!"
