@echo off
chcp 65001 >nul
title TAT SERVER VIDEO GOOGLE FLOW
echo Dang tat Server Video Google Flow (Cong 8100)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr ":8100"') do taskkill /PID %%a /F >nul 2>&1

echo.
echo Da tat Server Video Google Flow thanh cong!
ping 127.0.0.1 -n 2 >nul
