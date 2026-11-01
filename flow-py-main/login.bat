@echo off
chcp 65001 >nul
title DANG NHAP GOOGLE FLOW - TOOLMEDIA
echo ========================================================
echo   DANG MO TRINH DUYET CHROME DE DANG NHAP GOOGLE FLOW...
echo   Vui long dang nhap Gmail tren cua so Chrome vua bat len!
echo ========================================================
echo.
cd /d D:\ToolMedia\flow-py-main
python -X utf8 -m flow.cli.main login
echo.
echo ========================================================
echo   DA KET NOI GOOGLE FLOW! CUA SO NAY SE TU DONG DONG...
echo ========================================================
timeout /t 5 >nul
exit
