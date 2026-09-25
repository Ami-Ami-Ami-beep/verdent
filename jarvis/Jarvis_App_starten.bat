@echo off
REM Startet Jarvis als App mit eigenem Fenster.
REM Beim ersten Start: Python-Umgebung einrichten und Desktop-Verknuepfung anlegen.
cd /d "%~dp0"

if not exist .venv (
    echo Richte Jarvis ein, das dauert beim ersten Mal 1-2 Minuten ...
    python -m venv .venv
    if errorlevel 1 (
        echo Python wurde nicht gefunden. Bitte Python 3.10+ von python.org installieren
        echo und dabei "Add python.exe to PATH" anhaken.
        pause
        exit /b 1
    )
)

.venv\Scripts\python -c "import webview" 2>nul
if errorlevel 1 (
    echo Installiere die App-Pakete ...
    .venv\Scripts\python -m pip install --disable-pip-version-check -q -r requirements-gui.txt
    if errorlevel 1 (
        echo Installation fehlgeschlagen - siehe Meldungen oben.
        pause
        exit /b 1
    )
)

if not exist "%USERPROFILE%\.jarvis\shortcut-created" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Jarvis.lnk');" ^
      "$s.TargetPath = '%~dp0.venv\Scripts\pythonw.exe';" ^
      "$s.Arguments = '-m jarvis.gui';" ^
      "$s.WorkingDirectory = '%~dp0';" ^
      "$s.IconLocation = '%~dp0assets\jarvis.ico';" ^
      "$s.Description = 'Jarvis - dein KI-Assistent';" ^
      "$s.Save()"
    if not exist "%USERPROFILE%\.jarvis" mkdir "%USERPROFILE%\.jarvis"
    echo ok > "%USERPROFILE%\.jarvis\shortcut-created"
    echo Desktop-Verknuepfung "Jarvis" wurde angelegt.
)

start "" .venv\Scripts\pythonw.exe -m jarvis.gui
