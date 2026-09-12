@echo off
rem Clean build for the uivisor monorepo.
rem Run from anywhere — the script resolves the repo root automatically.

setlocal enabledelayedexpansion

rem Resolve repo root (parent of the scripts folder)
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
cd /d "%REPO_ROOT%"

echo.
echo -- Cleaning --
echo Removing workspace node_modules and dist directories...
if exist "node_modules"                  rmdir /s /q "node_modules"
if exist "packages\core\node_modules"   rmdir /s /q "packages\core\node_modules"
if exist "packages\core\dist"           rmdir /s /q "packages\core\dist"
if exist "uivisor-app\node_modules"     rmdir /s /q "uivisor-app\node_modules"
if exist "uivisor-app\dist"             rmdir /s /q "uivisor-app\dist"
if exist "recorder-app\node_modules"    rmdir /s /q "recorder-app\node_modules"
if exist "recorder-app\dist"            rmdir /s /q "recorder-app\dist"
echo Removing test-app node_modules and dist...
if exist "test-app\node_modules"        rmdir /s /q "test-app\node_modules"
if exist "test-app\dist"                rmdir /s /q "test-app\dist"

echo.
echo -- Installing workspace dependencies --
call npm install
if errorlevel 1 goto :error

echo.
echo -- Building packages/core --
call npm run build --workspace=packages/core
if errorlevel 1 goto :error

echo.
echo -- Building uivisor-app --
call npm run build --workspace=uivisor-app
if errorlevel 1 goto :error

echo.
echo -- Building recorder-app --
call npm run build --workspace=recorder-app
if errorlevel 1 goto :error

echo.
echo -- Installing Playwright browsers --
call npx playwright install chromium
if errorlevel 1 goto :error

echo.
echo -- Installing and building test-app --
cd test-app
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd /d "%REPO_ROOT%"

echo.
echo √ Clean build complete.
exit /b 0

:error
echo.
echo X Build failed.
exit /b 1
