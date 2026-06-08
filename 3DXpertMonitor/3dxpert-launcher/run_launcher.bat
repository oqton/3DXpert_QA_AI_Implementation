@echo off
setlocal

set APP_DIR=C:\QA_Stuff\Tools\PS_Scripts\3dxpert-launcher
set PORT=3000
set URL=http://localhost:%PORT%

echo.
echo  3DXpert Launcher
echo  ----------------

:: Check Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Please install it from https://nodejs.org
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo  Installing dependencies ^(first run only^)...
    call npm install
    if errorlevel 1 (
        echo  ERROR: npm install failed.
        pause
        exit /b 1
    )
)

:: Open browser after 2 second delay (gives server time to start)
echo  Starting server on %URL% ...
start "" cmd /c "timeout /t 2 /nobreak >nul && start "" "%URL%""

:: Start the server (keeps window open)
set PORT=%PORT%
node dist\index.cjs

pause
