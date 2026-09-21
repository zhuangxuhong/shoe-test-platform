@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts/release.mjs --config .local/deployment.json --rollback
pause
