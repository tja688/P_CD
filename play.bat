@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title PCD 网页试玩

powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\play-web.ps1"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
    echo.
    echo 启动失败，错误码 %EC%。
    pause
)
exit /b %EC%
