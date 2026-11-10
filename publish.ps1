# ImageTool - Publish Script
# Chay file nay de build va publish ban cap nhat len GitHub

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ImageTool - Publish to GitHub    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[CANH BAO] Khong chay bang quyen Administrator!" -ForegroundColor Yellow
    Write-Host "De tranh loi 'symbolic link', hay chay PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host "hoac bat Developer Mode trong Windows Settings" -ForegroundColor Yellow
    Write-Host ""
}

# Set GitHub Token
if (-not $env:GH_TOKEN) { $env:GH_TOKEN = $env:GITHUB_TOKEN }

# Get current version from package.json
$packageJson = Get-Content -Path "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version

Write-Host "[INFO] Version hien tai: $currentVersion" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to continue
$confirm = Read-Host "Ban co muon publish version $currentVersion len GitHub? (Y/N)"

if ($confirm -eq "Y" -or $confirm -eq "y") {
    Write-Host ""
    Write-Host "[BUILD] Dang build va publish..." -ForegroundColor Green
    Write-Host ""
    
    # Run build and publish
    npm run electron:build:win -- --publish always
    
    # Check if build was successful
    if ($LASTEXITCODE -eq 0) {
        # Build and upload Android APK
        Write-Host ""
        Write-Host "[BUILD] Dang build Android APK..." -ForegroundColor Cyan
        npx cap sync android
        Push-Location android
        .\gradlew.bat assembleRelease
        Pop-Location
        if (Test-Path "android\app\build\outputs\apk\release\app-release.apk") {
            Copy-Item "android\app\build\outputs\apk\release\app-release.apk" "release\ImageTool-Android.apk" -Force
            if (Get-Command gh -ErrorAction SilentlyContinue) {
                Write-Host "[UPLOAD] Dang upload ImageTool-Android.apk len GitHub Release..." -ForegroundColor Cyan
                gh release upload "v$currentVersion" "release\ImageTool-Android.apk" --clobber
            }
        }

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  HOAN THANH! Version $currentVersion da duoc publish" -ForegroundColor Green
        Write-Host "  Windows Installer (.exe) & Android APK (.apk)" -ForegroundColor Yellow
        Write-Host "  Link: https://github.com/Long2066/Hmongs-Photo/releases" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  LOI! Build that bai. Version chua duoc publish." -ForegroundColor Red
        Write-Host "  Hay thu chay PowerShell as Administrator" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Red
    }
}
else {
    Write-Host ""
    Write-Host "[HUY] Da huy publish." -ForegroundColor Red
}

Write-Host ""
Write-Host "Nhan phim bat ky de dong..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

