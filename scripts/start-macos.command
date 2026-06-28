#!/bin/bash
# TimeBank macOS 启动脚本
# 双击即可运行
cd "$(dirname "$0")/.." || exit 1

# 优先用 pnpm，否则用 node 直接跑
if command -v pnpm >/dev/null 2>&1; then
  exec pnpm start
else
  echo "未检测到 pnpm，请先安装 pnpm（npm i -g pnpm）"
  echo "或直接运行: node packages/server/dist/index.js"
  read -n 1 -s -r -p "按任意键关闭..."
  exit 1
fi
