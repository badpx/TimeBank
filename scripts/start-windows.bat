@echo off
cd /d "%~dp0\.."
where pnpm >nul 2>&1
if %errorlevel%==0 (
  pnpm start
) else (
  echo 未检测到 pnpm，请先安装 pnpm: npm i -g pnpm
  pause
  exit /b 1
)
