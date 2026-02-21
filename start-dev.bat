@echo off
setlocal

echo Starting backend...
start "backend" cmd /k "cd /d C:\Tmp\Evento Bokning\backend && npm run dev"

echo Starting frontend...
start "frontend" cmd /k "cd /d C:\Tmp\Evento Bokning\frontend && npm run dev"

echo Done. Two terminals opened.
