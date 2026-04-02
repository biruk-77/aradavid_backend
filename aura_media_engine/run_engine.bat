@echo off
echo [AURA ENGINE] Initializing Environment...

:: 1. SET PATHS
set MINGW_BIN=C:\msys64\mingw64\bin
set LIBCLANG_PATH=C:\msys64\mingw64\bin
set FFMPEG_DIR=C:\ffmpeg

:: 2. TELL RUST EXACTLY WHERE THE LIBS ARE
:: These are the variables ffmpeg-sys-next looks for to skip pkg-config
set LIBAVUTIL_NO_PKG_CONFIG=1
set LIBAVCODEC_NO_PKG_CONFIG=1
set LIBAVDEVICE_NO_PKG_CONFIG=1
set LIBAVFILTER_NO_PKG_CONFIG=1
set LIBAVFORMAT_NO_PKG_CONFIG=1
set LIBSWRESAMPLE_NO_PKG_CONFIG=1
set LIBSWSCALE_NO_PKG_CONFIG=1

:: Direct paths to the lib and include folders
set DEP_FFMPEG_LIB=%FFMPEG_DIR%\lib
set DEP_FFMPEG_INCLUDE=%FFMPEG_DIR%\include

:: 3. PATH & CLANG
set PATH=%MINGW_BIN%;%FFMPEG_DIR%\bin;%PATH%
set BINDGEN_EXTRA_CLANG_ARGS=-I"%FFMPEG_DIR%\include" -L"%FFMPEG_DIR%\lib"

echo [AURA ENGINE] Nuking old cache...
cargo clean

echo [AURA ENGINE] Starting Build...
cargo build -vv

pause