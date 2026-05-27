#!/usr/bin/env bash
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请前往 https://nodejs.org 安装"
    exit 1
fi

echo ""
echo "  酱味大鸡 启动中..."
echo "  浏览器将自动打开 http://localhost:8000"
echo "  按 Ctrl+C 停止服务器"
echo ""

node server.js "$@"
