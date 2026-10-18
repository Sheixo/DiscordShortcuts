@echo off
setlocal
title Discord Shortcuts - Installation du connecteur
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est requis. Installez la version LTS depuis https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0scripts\installer-connecteur.cjs" %*
set "installerExit=%errorlevel%"
echo.
pause
exit /b %installerExit%
