param(
  [switch]$NoVoice,
  [switch]$NoController,
  [switch]$NoDev
)

$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        D.A.N.I.S.H Launchpad             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan

# ── 1. Check dependencies ──────────────────────────────────
Write-Host "`n[1/4] Checking dependencies..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "  ✗ Python not found - voice & controller will not start" -ForegroundColor Red
  $NoVoice = $true; $NoController = $true
} else {
  Write-Host "  ✓ Python $(python --version 2>&1)" -ForegroundColor Green
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "  ✗ npm not found - dev server cannot start" -ForegroundColor Red
  $NoDev = $true
} else {
  Write-Host "  ✓ npm $(npm --version)" -ForegroundColor Green
}

# ── 2. Install Python deps ─────────────────────────────────
if (-not $NoVoice -or -not $NoController) {
  Write-Host "`n[2/4] Installing Python dependencies..." -ForegroundColor Yellow
  $pythonDirs = @{}
  if (-not $NoVoice)   { $pythonDirs["voice-service"]     = "voice-service/requirements.txt" }
  if (-not $NoController) { $pythonDirs["system-controller"] = $null }

  foreach ($dir in $pythonDirs.Keys) {
    $req = $pythonDirs[$dir]
    $path = Join-Path $root $dir
    if (Test-Path $path) {
      Push-Location $path
      if ($req -and (Test-Path $req)) {
        pip install -r $req -q 2>$null
        Write-Host "  ✓ $dir deps installed" -ForegroundColor Green
      } else {
        pip install fastapi uvicorn edge-tts pyautogui -q 2>$null
        Write-Host "  ✓ $dir base deps installed" -ForegroundColor Green
      }
      Pop-Location
    }
  }
}

# ── 3. Start services ──────────────────────────────────────
$jobs = @()

if (-not $NoVoice) {
  Write-Host "`n[3/4] Starting Voice Service (port 8765)..." -ForegroundColor Yellow
  $jobs += Start-Job -Name "voice-service" -ScriptBlock {
    param($p) Set-Location $p; python voice-service/main.py
  } -ArgumentList $root
  Start-Sleep 2
  Write-Host "  ✓ Listening on http://localhost:8765" -ForegroundColor Green
}

if (-not $NoController) {
  Write-Host "Starting System Controller (port 8766)..." -ForegroundColor Yellow
  $jobs += Start-Job -Name "system-controller" -ScriptBlock {
    param($p) Set-Location $p; python system-controller/main.py
  } -ArgumentList $root
  Start-Sleep 2
  Write-Host "  ✓ Listening on http://localhost:8766" -ForegroundColor Green
}

if (-not $NoDev) {
  Write-Host "Starting Next.js dev server (port 3000)..." -ForegroundColor Yellow
  $jobs += Start-Job -Name "next-dev" -ScriptBlock {
    param($p) Set-Location $p; npm run dev
  } -ArgumentList $root
  Start-Sleep 4
  Write-Host "  ✓ Listening on http://localhost:3000" -ForegroundColor Green
}

# ── 4. Summary ──────────────────────────────────────────────
Write-Host "`n╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  All services started!                    ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Voice Service  → http://localhost:8765  ║" -ForegroundColor Cyan
Write-Host "║  System Control → http://localhost:8766  ║" -ForegroundColor Cyan
Write-Host "║  D.A.N.I.S.H    → http://localhost:3000  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop all services." -ForegroundColor Gray

# Wait and cleanup on Ctrl+C
try {
  $jobs | Wait-Job
} finally {
  Write-Host "`nStopping services..." -ForegroundColor Yellow
  $jobs | Stop-Job -PassThru | Remove-Job
  Write-Host "Done." -ForegroundColor Green
}
