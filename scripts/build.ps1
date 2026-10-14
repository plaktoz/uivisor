# Clean build for the uivisor monorepo.
# Run from anywhere - the script resolves the repo root automatically.
# Works with Windows PowerShell 5.1 and PowerShell 7+ (pwsh) on any platform.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build.ps1
#         pwsh scripts/build.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

# -- helpers -------------------------------------------------------------------
function Write-Log  { param([string]$Message) Write-Host "> $Message" }
function Write-Step { param([string]$Message) Write-Host ''; Write-Host "-- $Message --" }

# Run a native command and stop the build if it exits non-zero
# ($ErrorActionPreference does not apply to native executables).
function Invoke-Native {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE"
    }
}

function Remove-Paths {
    param([string[]]$Paths)
    foreach ($p in $Paths) {
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
}

try {
    # -- clean -----------------------------------------------------------------
    Write-Step 'Cleaning'
    Write-Log 'Removing workspace node_modules and dist directories...'
    Remove-Paths @(
        'node_modules',
        'packages/core/node_modules', 'packages/core/dist',
        'uivisor-app/node_modules',   'uivisor-app/dist',
        'recorder-app/node_modules',  'recorder-app/dist'
    )
    Write-Log 'Removing test-app node_modules and dist...'
    Remove-Paths @('test-app/node_modules', 'test-app/dist')

    # -- workspace install -----------------------------------------------------
    Write-Step 'Installing workspace dependencies'
    Invoke-Native npm @('install')

    # -- packages/core ---------------------------------------------------------
    Write-Step 'Building packages/core'
    Invoke-Native npm @('run', 'build', '--workspace=packages/core')

    # -- uivisor-app -----------------------------------------------------------
    Write-Step 'Building uivisor-app'
    Invoke-Native npm @('run', 'build', '--workspace=uivisor-app')

    # -- recorder-app ----------------------------------------------------------
    Write-Step 'Building recorder-app'
    Invoke-Native npm @('run', 'build', '--workspace=recorder-app')

    # -- playwright browsers ---------------------------------------------------
    Write-Step 'Installing Playwright browsers'
    Invoke-Native npx @('playwright', 'install', 'chromium')

    # -- test-app (standalone - not in workspace) ------------------------------
    Write-Step 'Installing and building test-app'
    Push-Location 'test-app'
    try {
        Invoke-Native npm @('install')
        Invoke-Native npm @('run', 'build')
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host ''
    Write-Host "X Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# -- done ----------------------------------------------------------------------
Write-Host ''
Write-Host 'Clean build complete.' -ForegroundColor Green
exit 0
