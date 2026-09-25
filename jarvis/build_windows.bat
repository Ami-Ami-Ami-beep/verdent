@echo off
REM Baut dist\Jarvis.exe (einmalig ausfuehren, braucht Python 3.10+).
cd /d "%~dp0"
if not exist .venv python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-app.txt
.venv\Scripts\pyinstaller jarvis.spec --noconfirm
echo.
echo Fertig: %~dp0dist\Jarvis.exe
pause
