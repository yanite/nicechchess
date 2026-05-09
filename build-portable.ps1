# Tauri 便携版打包脚本
# 使用方法：在项目根目录运行 .\build-portable.ps1

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Nice Chinese Chess 便携版打包工具" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
if (-not (Test-Path "src-tauri\tauri.conf.json")) {
    Write-Host "错误：请在项目根目录运行此脚本！" -ForegroundColor Red
    exit 1
}

# 检查 Node.js
Write-Host "[1/5] 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

# 检查 Rust
Write-Host "[2/5] 检查 Rust..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version
    Write-Host "  ✓ Rust 版本: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 未找到 Rust，请先安装 Rust" -ForegroundColor Red
    exit 1
}

# 安装依赖
Write-Host "[3/5] 安装依赖..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 依赖安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 依赖安装完成" -ForegroundColor Green

# 构建
Write-Host "[4/5] 构建便携版..." -ForegroundColor Yellow
npm run tauri build -- --bundles portable
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 构建完成" -ForegroundColor Green

# 查找生成的文件
Write-Host "[5/5] 查找生成的文件..." -ForegroundColor Yellow
$portableFile = Get-ChildItem -Path "src-tauri\target\release\bundle\portable" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($portableFile) {
    $fileSize = [math]::Round($portableFile.Length / 1MB, 2)
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "  打包成功！" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "文件位置: $($portableFile.FullName)" -ForegroundColor White
    Write-Host "文件大小: ${fileSize} MB" -ForegroundColor White
    Write-Host ""
    Write-Host "使用说明:" -ForegroundColor Yellow
    Write-Host "  1. 将 .exe 文件复制到任意目录" -ForegroundColor White
    Write-Host "  2. 双击运行即可，无需安装" -ForegroundColor White
    Write-Host "  3. 首次运行会在同目录创建配置文件" -ForegroundColor White
    Write-Host ""
    
    # 询问是否打开目录
    $openDir = Read-Host "是否打开文件所在目录？(Y/n)"
    if ($openDir -ne "n" -and $openDir -ne "N") {
        explorer.exe (Split-Path $portableFile.FullName)
    }
} else {
    Write-Host "  ✗ 未找到生成的便携版文件" -ForegroundColor Red
    Write-Host "  请检查 src-tauri\target\release\bundle\portable 目录" -ForegroundColor Yellow
}
