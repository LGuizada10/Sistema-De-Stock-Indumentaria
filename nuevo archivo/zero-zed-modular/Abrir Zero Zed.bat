@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "index.html" (
  echo No se encontro index.html. Verifica que la carpeta este completa.
  pause
  exit /b 1
)
start "" "%~dp0index.html"
