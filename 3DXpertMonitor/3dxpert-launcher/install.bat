@echo off
setlocal EnableDelayedExpansion
title 3DXpert Monitor - Installer
color 0A

echo.
echo  ============================================================
echo   3DXpert Monitor - Installation
echo   Oqton QA Toolbox
echo  ============================================================
echo.

REM ── Step 1: Check Node.js ─────────────────────────────────────
echo [1/4] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: Node.js is not installed or not in PATH.
    echo.
    echo  Please install Node.js v18 or later from:
    echo    https://nodejs.org/en/download
    echo.
    echo  Restart this installer after installing Node.js.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  OK - Node.js %NODE_VER% found.
echo.

REM ── Step 2: Check npm ─────────────────────────────────────────
echo [2/4] Checking npm...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  ERROR: npm not found. Reinstall Node.js from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo  OK - npm %NPM_VER% found.
echo.

REM ── Step 3: Install dependencies ──────────────────────────────
echo [3/4] Installing dependencies (this may take a minute)...
cd /d "%~dp0"
call npm install --prefer-offline 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: npm install failed.
    echo  Check your internet connection and try again.
    pause
    exit /b 1
)
echo  OK - Dependencies installed.
echo.

REM ── Step 4: Verify NVIDIA drivers (optional, non-fatal) ───────
echo [4/4] Checking NVIDIA driver (nvidia-smi)...
where nvidia-smi >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  WARNING: nvidia-smi not found.
    echo  GPU memory column will show n/a.
    echo  Install the latest NVIDIA driver from https://www.nvidia.com/drivers
) else (
    for /f "tokens=*" %%v in ('nvidia-smi --query-gpu=driver_version --format=csv,noheader 2^>nul') do set DRV=%%v
    echo  OK - NVIDIA driver !DRV! found.
)
echo.

REM ── Done ──────────────────────────────────────────────────────
echo  ============================================================
echo   Installation complete!
echo.
echo   To launch the app, double-click:
echo     run_launcher.bat
echo.
echo   The app will open automatically in your default browser.
echo  ============================================================
echo.
pause
