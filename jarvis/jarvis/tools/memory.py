"""Langzeitgedaechtnis: Jarvis merkt sich Fakten ueber dich und deine Projekte."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from . import context
from .registry import tool


def _file() -> Path:
    return Path(context.cfg.get("memory_file", "~/.jarvis/memory.json")).expanduser()


def load_memories() -> list[dict]:
    f = _file()
    if not f.exists():
        return []
    return json.loads(f.read_text(encoding="utf-8"))


def _save(items: list[dict]) -> None:
    f = _file()
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


@tool(
    "remember",
    "Speichert dauerhaft eine Information (z.B. Vorlieben, Server-Adressen, Projektinfos). Keine Passwoerter!",
    {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
)
def remember(text: str) -> str:
    items = load_memories()
    items.append({"id": max((i["id"] for i in items), default=0) + 1, "text": text,
                  "created": datetime.now().isoformat(timespec="minutes")})
    _save(items)
    return f"Gemerkt (#{items[-1]['id']})."


@tool(
    "recall",
    "Durchsucht das Gedaechtnis. Ohne Suchbegriff werden alle Eintraege gezeigt.",
    {"type": "object", "properties": {"query": {"type": "string"}}},
)
def recall(query: str | None = None) -> list:
    items = load_memories()
    if query:
        words = query.lower().split()
        items = [i for i in items if any(w in i["text"].lower() for w in words)]
    return items or [{"info": "Nichts gefunden."}]


@tool(
    "forget",
    "Loescht einen Gedaechtnis-Eintrag anhand seiner ID.",
    {"type": "object", "properties": {"id": {"type": "integer"}}, "required": ["id"]},
)
def forget(id: int) -> str:
    items = load_memories()
    rest = [i for i in items if i["id"] != id]
    _save(rest)
    return "Geloescht." if len(rest) < len(items) else f"Kein Eintrag #{id}."
