@echo off
echo =====================================
echo   Nice Chinese Chess Portable Builder
echo =====================================
echo.

REM Check if in correct directory
if not exist "src-tauri\tauri.conf.json" (
    echo ERROR: Please run this script in project root directory!
    pause
    exit /b 1
)

REM Check Node.js
echo [1/6] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Node.js not found, please install Node.js first
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo   + Node.js version: %NODE_VERSION%

REM Check Rust
echo [2/6] Checking Rust...
where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Rust not found, please install Rust first
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('rustc --version') do set RUST_VERSION=%%i
echo   + Rust version: %RUST_VERSION%

REM Install dependencies
echo [3/6] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo   X Dependencies installation failed
    pause
    exit /b 1
)
echo   + Dependencies installed

REM Build
echo [4/6] Building release version...
echo NOTE: This will include textures, fonts, and other assets
call npm run tauri build
if %errorlevel% neq 0 (
    echo   X Build failed
    pause
    exit /b 1
)
echo   + Build completed

REM Create portable version
echo [5/6] Creating portable version...
set RELEASE_DIR=src-tauri\target\release
set PORTABLE_DIR=portable-build

if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%"

REM Copy main executable
if exist "%RELEASE_DIR%\tauri-app.exe" (
    copy "%RELEASE_DIR%\tauri-app.exe" "%PORTABLE_DIR%\NiceChineseChess.exe" >nul
    echo   + Main executable copied
) else (
    echo   X Main executable not found
    pause
    exit /b 1
)

REM Create assets directory structure
mkdir "%PORTABLE_DIR%\assets"
mkdir "%PORTABLE_DIR%\assets\fonts"
mkdir "%PORTABLE_DIR%\assets\textures"
mkdir "%PORTABLE_DIR%\assets\chess_score"

REM Copy fonts
if exist "assets\fonts" (
    xcopy "assets\fonts" "%PORTABLE_DIR%\assets\fonts\" /E /I /Q >nul
    echo   + Fonts copied to assets/fonts
) else (
    echo   ! Fonts directory not found
)

REM Copy textures
if exist "assets\textures" (
    xcopy "assets\textures" "%PORTABLE_DIR%\assets\textures\" /E /I /Q >nul
    echo   + Textures copied to assets/textures
) else (
    echo   ! Textures directory not found
)

REM Copy chess scores
if exist "assets\chess_score" (
    xcopy "assets\chess_score" "%PORTABLE_DIR%\assets\chess_score\" /E /I /Q >nul
    echo   + Chess scores copied to assets/chess_score
) else (
    echo   ! Chess scores directory not found
)

REM Copy HDR and PNG files
if exist "assets\*.hdr" (
    copy "assets\*.hdr" "%PORTABLE_DIR%\assets\" >nul
    echo   + HDR files copied
)
if exist "assets\*.png" (
    copy "assets\*.png" "%PORTABLE_DIR%\assets\" >nul
    echo   + PNG files copied
)

REM Copy pikafish engine
if exist "assets\pikafish" (
    xcopy "assets\pikafish" "%PORTABLE_DIR%\assets\pikafish\" /E /I /Q >nul
    echo   + AI engine copied
) else (
    echo   ! Pikafish directory not found
)

REM Create README
echo [6/6] Creating README...
(
echo Nice Chinese Chess - Portable Version
echo =====================================
echo.
echo Usage:
echo   1. Double-click the .exe file to run
echo   2. No installation required
echo   3. Config file will be created in same directory
echo.
echo System Requirements:
echo   - Windows 10 or later
echo   - 64-bit system
echo.
echo Features:
echo   - 3D Chinese Chess
echo   - AI opponent (Pikafish engine)
echo   - Game notation support
echo.
) > "%PORTABLE_DIR%\README.txt"

echo   + README created

REM Show result
echo.
echo =====================================
echo   Build Success!
echo =====================================
echo.
echo Portable version location: %CD%\%PORTABLE_DIR%
echo.
echo Files included:
dir /b "%PORTABLE_DIR%"
