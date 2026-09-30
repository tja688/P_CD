@echo off
rem Double-click to play the web preview. Free ports are probed from 5173 and 7420.
cd /d "%~dp0"
title PCD Play
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\play-web.ps1"
exit /b %ERRORLEVEL%
