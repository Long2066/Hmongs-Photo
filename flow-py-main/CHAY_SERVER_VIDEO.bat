@echo off
chcp 65001 >nul
title SERVER TAO VIDEO GOOGLE FLOW - KHONG DONG CUA SO NAY
echo ========================================================
echo   SERVER TAO VIDEO GOOGLE FLOW (cong 8100)
echo   GIU CUA SO NAY MO trong luc tao video.
echo   Dong cua so nay = tat server = web khong tao duoc video.
echo ========================================================
echo.

REM Tat server cu (neu con) dang chiem cong 8100
for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr ":8100"') do taskkill /PID %%a /F >nul 2>&1

REM Tat Chrome Flow cu chay an (neu co) de mo lai tren man hinh that
for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr "127.0.0.1:9222"') do taskkill /PID %%a /T /F >nul 2>&1

cd /d D:\ToolMedia\flow-py-main
python -X utf8 server.py
echo.
echo Server da dung. Bam phim bat ky de dong.
pause >nul
