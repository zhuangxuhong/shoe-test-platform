@echo off
chcp 65001 >nul
cd /d "%~dp0"
node --env-file=.env.teable-analysis analysis-web/server.js
pause
