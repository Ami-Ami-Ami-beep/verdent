"""Konfiguration laden (config.yaml) mit sinnvollen Standardwerten."""

from __future__ import annotations

import copy
import os
from pathlib import Path

import yaml

JARVIS_HOME = Path(os.environ.get("JARVIS_HOME", Path.home() / ".jarvis"))

DEFAULTS: dict = {
    "name": "Jarvis",
    "user_name": "",
    "language": "de",
    "llm": {
        # "ollama" = komplett lokal auf deinem PC, "claude" = Claude API (staerker, braucht Internet + API-Key)
        "provider": "ollama",
        "ollama": {"host": "http://localhost:11434", "model": "qwen3:14b"},
        "claude": {"model": "claude-opus-5", "effort": "high"},
    },
    # Ordner, in dem Jarvis bevorzugt arbeitet (Projekte, Skripte, Server-Setups ...)
    "workspace": str(Path.home() / "jarvis-workspace"),
    "permissions": {
        # "ask"  = bei jeder veraendernden Aktion nachfragen
        # "auto" = alles erlauben, ausser Tools in always_ask
        "mode": "ask",
        "auto_approve": [],  # Tools, die im ask-Modus trotzdem ohne Rueckfrage laufen
        "always_ask": ["send_email"],  # Tools, die IMMER nachfragen, auch im auto-Modus
    },
    "budget": {
        # "free"   = nur kostenlose / Open-Source-Loesungen
        # "budget" = darf kostenpflichtige Loesungen VORSCHLAGEN bis max_eur (kauft nie selbst ein)
        "mode": "free",
        "max_eur": 0,
    },
    "email": {
        "imap_host": "",
        "imap_port": 993,
        "smtp_host": "",
        "smtp_port": 465,
        "username": "",
        "password_env": "JARVIS_EMAIL_PASSWORD",
    },
    "calendar": {
        # Private iCal/ICS-Links (Google Kalender, Outlook, iCloud, t-online ...)
        "ics_urls": [],
        # Oder lokale .ics-Dateien
        "ics_files": [],
        "timezone": "Europe/Berlin",
    },
    "plugins_dir": str(JARVIS_HOME / "plugins"),
    "memory_file": str(JARVIS_HOME / "memory.json"),
}


def _merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def find_config_path(explicit: str | None = None) -> Path | None:
    candidates = [explicit] if explicit else []
    candidates += [os.environ.get("JARVIS_CONFIG"), "config.yaml", str(JARVIS_HOME / "config.yaml")]
    for c in candidates:
        if c and Path(c).expanduser().is_file():
            return Path(c).expanduser()
    return None


def load_config(explicit: str | None = None) -> dict:
    path = find_config_path(explicit)
    data = {}
    if path:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    cfg = _merge(DEFAULTS, data)
    cfg["_path"] = str(path) if path else None
    for key in ("workspace", "plugins_dir", "memory_file"):
        cfg[key] = str(Path(cfg[key]).expanduser())
    return cfg
