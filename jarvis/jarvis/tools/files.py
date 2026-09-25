"""Dateisystem-Tools: lesen, schreiben, auflisten, suchen."""

from __future__ import annotations

import fnmatch
import os
from pathlib import Path

from .registry import CONFIRM, tool

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".cache"}


def _p(path: str) -> Path:
    return Path(os.path.expandvars(path)).expanduser()


@tool(
    "read_file",
    "Liest eine Textdatei. Optional nur einen Zeilenbereich (1-basiert).",
    {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Pfad zur Datei"},
            "start_line": {"type": "integer"},
            "end_line": {"type": "integer"},
        },
        "required": ["path"],
    },
)
def read_file(path: str, start_line: int | None = None, end_line: int | None = None) -> str:
    text = _p(path).read_text(encoding="utf-8", errors="replace")
    if start_line or end_line:
        lines = text.splitlines()
        s = max((start_line or 1) - 1, 0)
        e = end_line or len(lines)
        return "\n".join(f"{i + 1}: {line}" for i, line in enumerate(lines[s:e], start=s))
    return text


@tool(
    "write_file",
    "Schreibt (oder ueberschreibt) eine Datei. Legt fehlende Ordner an. "
    "Mit append=true wird angehaengt statt ueberschrieben.",
    {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
            "append": {"type": "boolean"},
        },
        "required": ["path", "content"],
    },
    risk=CONFIRM,
)
def write_file(path: str, content: str, append: bool = False) -> str:
    p = _p(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a" if append else "w", encoding="utf-8") as f:
        f.write(content)
    return f"{'Angehaengt an' if append else 'Geschrieben'}: {p} ({len(content)} Zeichen)"


@tool(
    "edit_file",
    "Ersetzt einen exakt vorkommenden Textabschnitt in einer Datei durch neuen Text.",
    {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "old_text": {"type": "string", "description": "Muss genau einmal in der Datei vorkommen"},
            "new_text": {"type": "string"},
        },
        "required": ["path", "old_text", "new_text"],
    },
    risk=CONFIRM,
)
def edit_file(path: str, old_text: str, new_text: str) -> str:
    p = _p(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old_text)
    if count != 1:
        raise ValueError(f"old_text kommt {count}-mal vor, erwartet genau einmal")
    p.write_text(text.replace(old_text, new_text), encoding="utf-8")
    return f"Geaendert: {p}"


@tool(
    "list_dir",
    "Listet den Inhalt eines Ordners auf (Ordner enden mit /).",
    {
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "required": ["path"],
    },
)
def list_dir(path: str) -> str:
    p = _p(path)
    entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
    lines = []
    for e in entries[:500]:
        if e.is_dir():
            lines.append(e.name + "/")
        else:
            try:
                lines.append(f"{e.name}  ({e.stat().st_size} B)")
            except OSError:
                lines.append(e.name)
    if len(entries) > 500:
        lines.append(f"... und {len(entries) - 500} weitere")
    return "\n".join(lines) or "(leer)"


@tool(
    "search_files",
    "Sucht rekursiv nach Dateien per Namensmuster (z.B. '*.py') und optional nach Text im Inhalt.",
    {
        "type": "object",
        "properties": {
            "root": {"type": "string", "description": "Startordner"},
            "pattern": {"type": "string", "description": "Dateinamen-Muster, Standard '*'"},
            "contains": {"type": "string", "description": "Text, der in der Datei vorkommen soll"},
            "max_results": {"type": "integer"},
        },
        "required": ["root"],
    },
)
def search_files(root: str, pattern: str = "*", contains: str | None = None, max_results: int = 100) -> str:
    results: list[str] = []
    for dirpath, dirnames, filenames in os.walk(_p(root)):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if not fnmatch.fnmatch(fn, pattern):
                continue
            full = Path(dirpath) / fn
            if contains:
                try:
                    with open(full, encoding="utf-8", errors="ignore") as f:
                        for no, line in enumerate(f, 1):
                            if contains in line:
                                results.append(f"{full}:{no}: {line.strip()[:200]}")
                                break
                        else:
                            continue
                except OSError:
                    continue
            else:
                results.append(str(full))
            if len(results) >= max_results:
                return "\n".join(results) + "\n... (Limit erreicht)"
    return "\n".join(results) or "Nichts gefunden."
