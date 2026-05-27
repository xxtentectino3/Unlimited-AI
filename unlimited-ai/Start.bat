@echo off
chcp 65001 >nul
title 酱味大鸡

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请前往 https://nodejs.org 安装
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [首次运行] 正在安装依赖...
    call npm install --no-save --no-audit --no-fund --loglevel=error --omit=dev --ignore-scripts
)

echo.
echo   酱味大鸡 启动中...
echo   浏览器将自动打开 http://localhost:8000
echo   按 Ctrl+C 停止服务器
echo.

:: Start server
node server.js
pause
