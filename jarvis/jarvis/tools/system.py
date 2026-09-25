"""System-Tools: Befehle ausfuehren, Programme/Tabs oeffnen, Systeminfo."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import webbrowser
from datetime import datetime

from .registry import CONFIRM, tool

IS_WINDOWS = sys.platform.startswith("win")


@tool(
    "run_command",
    "Fuehrt einen Shell-Befehl aus (Windows: PowerShell, sonst bash) und gibt stdout/stderr zurueck. "
    "Fuer Programme, Skripte, Installationen, git, docker, Server-Setups usw.",
    {
        "type": "object",
        "properties": {
            "command": {"type": "string"},
            "cwd": {"type": "string", "description": "Arbeitsordner (optional)"},
            "timeout": {"type": "integer", "description": "Sekunden, Standard 120"},
        },
        "required": ["command"],
    },
    risk=CONFIRM,
)
def run_command(command: str, cwd: str | None = None, timeout: int = 120) -> str:
    if IS_WINDOWS:
        shell = shutil.which("pwsh") or "powershell"
        args = [shell, "-NoProfile", "-Command", command]
    else:
        args = ["bash", "-lc", command]
    try:
        proc = subprocess.run(
            args,
            cwd=os.path.expanduser(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired as e:
        return f"Timeout nach {timeout}s.\nstdout:\n{e.stdout or ''}\nstderr:\n{e.stderr or ''}"
    out = f"Exit-Code: {proc.returncode}\n"
    if proc.stdout:
        out += f"--- stdout ---\n{proc.stdout}"
    if proc.stderr:
        out += f"\n--- stderr ---\n{proc.stderr}"
    return out


@tool(
    "start_program",
    "Startet ein Programm oder eine Datei im Hintergrund (ohne auf das Ende zu warten), "
    "z.B. einen Server, einen Editor oder ein Spiel.",
    {
        "type": "object",
        "properties": {
            "command": {"type": "string"},
            "cwd": {"type": "string"},
        },
        "required": ["command"],
    },
    risk=CONFIRM,
)
def start_program(command: str, cwd: str | None = None) -> str:
    kwargs: dict = {"cwd": os.path.expanduser(cwd) if cwd else None, "shell": True}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    else:
        kwargs["start_new_session"] = True
    proc = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kwargs)
    return f"Gestartet (PID {proc.pid}): {command}"


@tool(
    "open_url",
    "Oeffnet eine Webseite in einem neuen Browser-Tab.",
    {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
    risk=CONFIRM,
)
def open_url(url: str) -> str:
    if "://" not in url:
        url = "https://" + url
    webbrowser.open_new_tab(url)
    return f"Tab geoeffnet: {url}"


@tool(
    "open_path",
    "Oeffnet eine Datei oder einen Ordner mit dem Standardprogramm des Systems.",
    {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
    risk=CONFIRM,
)
def open_path(path: str) -> str:
    path = os.path.expanduser(path)
    if IS_WINDOWS:
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])
    return f"Geoeffnet: {path}"


@tool("system_info", "Infos ueber den PC: Betriebssystem, Datum/Uhrzeit, Home-Ordner, verfuegbare Tools.")
def system_info() -> dict:
    tools = ["python", "git", "docker", "node", "npm", "java", "ssh", "code", "winget", "choco", "apt", "brew"]
    total, used, free = shutil.disk_usage(os.path.expanduser("~"))
    return {
        "os": f"{platform.system()} {platform.release()}",
        "machine": platform.machine(),
        "now": datetime.now().astimezone().isoformat(timespec="minutes"),
        "home": os.path.expanduser("~"),
        "cwd": os.getcwd(),
        "cpu_count": os.cpu_count(),
        "disk_free_gb": round(free / 1e9, 1),
        "installed": {t: bool(shutil.which(t)) for t in tools},
    }
