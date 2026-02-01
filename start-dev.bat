@echo off
setlocal

echo Starting backend...
start "backend" cmd /k "cd /d C:\Tmp\Event\backend && npm run dev"

echo Starting frontend...
start "frontend" cmd /k "cd /d C:\Tmp\Event\frontend && npm run dev"

echo Done. Two terminals opened.
