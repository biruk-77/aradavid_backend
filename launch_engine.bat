@echo off
title AURA SYSTEM — UNIFIED ORCHESTRATOR
setlocal enabledelayedexpansion

:: ─── CONFIGURATION ───
set FFMPEG_DIR=C:\ffmpeg
set LIBCLANG_PATH=C:\msys64\mingw64\bin
set PATH=C:\ffmpeg\bin;C:\msys64\mingw64\bin;%PATH%
set BASE_DIR=%~dp0

:: Bypass pkg-config for the engine if it ever compiles again
set LIBAVUTIL_NO_PKG_CONFIG=1
set LIBAVCODEC_NO_PKG_CONFIG=1
set LIBAVDEVICE_NO_PKG_CONFIG=1
set LIBAVFILTER_NO_PKG_CONFIG=1
set LIBAVFORMAT_NO_PKG_CONFIG=1
set LIBSWRESAMPLE_NO_PKG_CONFIG=1
set LIBSWSCALE_NO_PKG_CONFIG=1

echo ======================================================
echo    AURA MEDIA ENGINE - MISSION CONTROL (v2)
echo ======================================================
echo  [SYSTEM] INITIALIZING MISSION CONTROL...
echo.

:: 1. LAUNCH COMMAND PLANE (General)
echo  [1/3] LAUNCHING COMMAND PLANE (Port 8080)...
set GEN_EXE="%BASE_DIR%aura_general\target\debug\aura_general.exe"
start "AURA GENERAL" /d "%BASE_DIR%aura_general" %GEN_EXE%

:: 2. LAUNCH MEDIA ENGINE
echo  [2/3] LAUNCHING MEDIA ENGINE (Port 8081)...
timeout /t 2 > nul
set ENG_EXE="%BASE_DIR%aura_media_engine\target_deploy\release\aradavid.exe"
start "AURA MEDIA ENGINE" /d "%BASE_DIR%aura_media_engine" cmd /c "%ENG_EXE% > %BASE_DIR%engine_unified.log 2>&1"

:: 3. LAUNCH SCOUT DASHBOARD
echo  [3/3] LAUNCHING SCOUT DASHBOARD (Port 3031)...
timeout /t 2 > nul
start "AURA SCOUT" /d "%BASE_DIR%aura_scout" node scout.js

echo.
echo  [SUCCESS] ALL SYSTEMS ONLINE.
echo  [LINK] DASHBOARD: http://localhost:3031
echo ======================================================
pause
