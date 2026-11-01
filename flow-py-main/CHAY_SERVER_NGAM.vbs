Set WshShell = CreateObject("WScript.Shell")
' Tat tien trinh cu dang chiem cong 8100 (neu co)
WshShell.Run "powershell -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort 8100 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True
' Khoi dong server python hoan toan an (WindowStyle = 0)
WshShell.Run "cmd /c cd /d D:\ToolMedia\flow-py-main && python -X utf8 server.py", 0, False
' Hien thong bao nho trong 3 giay de bao da chay ngam
WshShell.Popup "Server Video Google Flow đã khởi động và đang CHẠY NGẦM thành công!" & vbCrLf & "Cửa sổ đen đã được ẩn hoàn toàn. Anh có thể mở web tạo video thoải mái!", 3, "Google Flow Server (Chạy Ngầm)", 64
Set WshShell = Nothing
