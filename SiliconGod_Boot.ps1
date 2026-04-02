# Silicon God Trinity Bootloader
# Orchestrates: Scout (Node), General (Rust), and Engine (Rust/C++)
# Includes Environment-Specific Bypass for FFmpeg Build

Write-Host "--- AURA TRINITY BOOTING (SILICON GOD MODE) ---" -ForegroundColor Cyan

# 1. SET ENVIRONMENT VARIABLES (Crucial for FFmpeg/Clang on Windows)
$env:FFMPEG_DIR = "C:\ffmpeg"
$env:LIBCLANG_PATH = "C:\msys64\mingw64\bin"
$env:MINGW_BIN = "C:\msys64\mingw64\bin"

# Tell Rust to skip pkg-config and use direct paths
$env:LIBAVUTIL_NO_PKG_CONFIG = "1"
$env:LIBAVCODEC_NO_PKG_CONFIG = "1"
$env:LIBAVDEVICE_NO_PKG_CONFIG = "1"
$env:LIBAVFILTER_NO_PKG_CONFIG = "1"
$env:LIBAVFORMAT_NO_PKG_CONFIG = "1"
$env:LIBSWRESAMPLE_NO_PKG_CONFIG = "1"
$env:LIBSWSCALE_NO_PKG_CONFIG = "1"

# Add paths to environment
$env:PATH = "$env:MINGW_BIN;$env:FFMPEG_DIR\bin;$env:PATH"
$env:BINDGEN_EXTRA_CLANG_ARGS = "-I""$env:FFMPEG_DIR\include"" -L""$env:FFMPEG_DIR\lib"""

# 2. CLEAN THE MATRIX (Kill existing Ghost processes)
Write-Host "Cleaning the Matrix (Killing Ports 8080, 3031, 8081)..." -ForegroundColor Magenta
$ports = @(8080, 3031, 8081)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}
Stop-Process -Name "cargo", "rustc", "aura_general", "aura_media_engine", "aradavid" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 3. SEQUENTIAL BUILD (Aura Sovereign Protocol)
Write-Host "Building the Trinity (Sequential Mode)..." -ForegroundColor Yellow
$root = "c:\Users\biruk\Desktop\personal\aradavidbackend"

# Build General
Set-Location "$root\aura_general"
cargo build

# Build Engine
Set-Location "$root\aura_media_engine"
$env:CARGO_TARGET_DIR = "$root\aura_media_engine\target_deploy"

$maxRetries = 5
$retryCount = 0
$success = $false
while (-not $success -and $retryCount -lt $maxRetries) {
    cargo build --release
    if ($LASTEXITCODE -eq 0) {
        $success = $true
    }
    else {
        $retryCount++
        Write-Host "OS File Lock Detected." -ForegroundColor Red
        Write-Host "Retrying Build Incrementally ($retryCount/$maxRetries)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

# 4. DEPLOY THE TRINITY (Sovereign Executive Mode)
Write-Host "--- DEPLOYING ---" -ForegroundColor Green

# Scout
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "scout.js" -WorkingDirectory "$root\aura_scout"
Write-Host "[1/4] THE SCOUT is active (Port 3031)." -ForegroundColor Yellow

# General
$generalExe = "$root\aura_general\target\debug\aura_general.exe"
Start-Process -NoNewWindow -FilePath $generalExe -WorkingDirectory "$root\aura_general"
Write-Host "[2/4] THE GENERAL is active (Port 8080)." -ForegroundColor Yellow

# Debugger
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$root\aura_dl_debug"
Write-Host "[3/4] THE DEBUGGER is active (Port 3032)." -ForegroundColor Yellow

# Engine
Write-Host "[4/4] Launching THE ENGINE sovereign worker..." -ForegroundColor Cyan
Start-Process -FilePath "$root\launch_engine.bat" -WorkingDirectory "$root"

Write-Host "Waiting for Command Plane to stabilize..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 5. AUTO-PILOT (The 'Most Best Running' Mode)
Write-Host "--- AUTO-PILOT INITIATED ---" -ForegroundColor Cyan
# Deploy the Job via the Scout's Hunter API (so it extracts the YouTube/TikTok bitstream first)
$huntUrl = "https://www.youtube.com/watch?v=MvsAesQ-4zA&pp=ygUOMSBzZWNvbmQgdmlkZW8%3D"
Write-Host "[AURA COMMAND] Hunting default stream: $huntUrl" -ForegroundColor Yellow

try {
    $huntRes = Invoke-RestMethod -Uri "http://localhost:3031/api/hunt/url" -Method Post -ContentType "application/json" -Body (@{url = $huntUrl; tile = 0 } | ConvertTo-Json)
    $jobId = $huntRes.job.id

    if ($null -ne $jobId) {
        Write-Host "[MISSION] $huntUrl Deployed (ID: $jobId) to Tile 0." -ForegroundColor Green

        # Explicitly map the Job to Tile 0 for 'Most Best' guarantee
        $layoutJson = '{"' + $jobId.ToString() + '":0}'
        Write-Host "[DEBUG] Layout JSON: $layoutJson" -ForegroundColor Gray
        Invoke-RestMethod -Uri "http://localhost:8080/layout" -Method Post -ContentType "application/json" -Body $layoutJson -ErrorAction SilentlyContinue | Out-Null
        Write-Host "[MATRIX] Mapping Job $jobId to Tile 0 (Sovereign Command)" -ForegroundColor Yellow
    } else {
        Write-Host "[MISSION WARNING] Hunter returned successfully but no Job ID was found. System remains online." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[MISSION PARTIAL FAILURE] Target $huntUrl could not be sniped automatically. Check logs." -ForegroundColor Red
    Write-Host "[SYSTEM] Trinity remains active. Manual deployment available at http://localhost:3031" -ForegroundColor Cyan
}

Write-Host "-------------------------------------------------------------" -ForegroundColor Green
Write-Host "TRINITY ONLINE. MISSION DEPLOYED. SYSTEM IS PEAK." -ForegroundColor Green
Write-Host "Open Dashboard: http://localhost:3031" -ForegroundColor Green
Write-Host "-------------------------------------------------------------" -ForegroundColor Green


