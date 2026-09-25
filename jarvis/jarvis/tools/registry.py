"""Tool-Registry: jedes Werkzeug, das Jarvis benutzen kann, wird hier registriert.

Ein Tool besteht aus Name, Beschreibung, JSON-Schema fuer die Parameter,
einer Python-Funktion und einer Risikostufe:

- "safe":    nur lesen (Dateien lesen, Kalender, Mails lesen) -> laeuft ohne Rueckfrage
- "confirm": veraendert etwas (schreiben, Programme starten, Mails senden)
             -> Jarvis fragt vorher, ausser du erlaubst es in der Config
"""

from __future__ import annotations

import json
import traceback
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Callable

SAFE = "safe"
CONFIRM = "confirm"

# approver(tool, args) -> True wenn ausgefuehrt werden darf
Approver = Callable[["Tool", dict], bool]

MAX_RESULT_CHARS = 30_000


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    func: Callable[..., Any]
    risk: str = SAFE
    source: str = "builtin"


@dataclass
class ToolRegistry:
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, t: Tool) -> None:
        self.tools[t.name] = t

    def unregister_source(self, source: str) -> None:
        for name in [n for n, t in self.tools.items() if t.source == source]:
            del self.tools[name]

    def get(self, name: str) -> Tool | None:
        return self.tools.get(name)

    def all(self) -> list[Tool]:
        return sorted(self.tools.values(), key=lambda t: t.name)

    def execute(self, name: str, args: dict | None, approver: Approver) -> tuple[str, bool]:
        """Fuehrt ein Tool aus. Gibt (Ergebnistext, is_error) zurueck."""
        t = self.get(name)
        if t is None:
            return f"Unbekanntes Tool: {name}", True
        args = args or {}
        if not isinstance(args, dict):
            return f"Ungueltige Argumente fuer {name}: {args!r}", True
        missing = [p for p in t.parameters.get("required", []) if p not in args]
        if missing:
            return f"Fehlende Parameter fuer {name}: {', '.join(missing)}", True
        if t.risk != SAFE and not approver(t, args):
            return "Der Benutzer hat diese Aktion abgelehnt.", True
        try:
            result = t.func(**args)
        except Exception as e:  # Fehler gehen als Tool-Ergebnis zurueck ans Modell
            return f"Fehler in {name}: {e}\n{traceback.format_exc(limit=3)}", True
        text = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False, indent=2, default=str)
        if len(text) > MAX_RESULT_CHARS:
            text = text[:MAX_RESULT_CHARS] + f"\n... [gekuerzt, {len(text)} Zeichen insgesamt]"
        return text, False


registry = ToolRegistry()

# Wird beim Laden von Plugins gesetzt, damit deren Tools als Plugin markiert werden.
_current_source = "builtin"


@contextmanager
def tool_source(source: str):
    """Alle in diesem Block registrierten Tools bekommen die angegebene Quelle."""
    global _current_source
    previous, _current_source = _current_source, source
    try:
        yield
    finally:
        _current_source = previous


def tool(name: str, description: str, parameters: dict | None = None, risk: str = SAFE):
    """Decorator zum Registrieren eines Tools.

    Beispiel:
        @tool("hallo", "Sagt hallo", {"type": "object", "properties": {"name": {"type": "string"}},
                                     "required": ["name"]})
        def hallo(name: str) -> str:
            return f"Hallo {name}"
    """
    schema = parameters or {"type": "object", "properties": {}}

    def deco(func):
        registry.register(Tool(name, description, schema, func, risk, _current_source))
        return func

    return deco
