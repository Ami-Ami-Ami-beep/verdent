"""Plugin-System: Jarvis kann sich selbst neue Tools schreiben.

Ein Plugin ist eine .py-Datei im Plugin-Ordner (Standard ~/.jarvis/plugins),
die mit dem @tool-Decorator neue Tools registriert. Siehe plugins_example/.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

from . import context
from .registry import CONFIRM, registry, tool, tool_source

PLUGIN_TEMPLATE_HINT = '''from jarvis.tools import tool, CONFIRM

@tool("mein_tool", "Was das Tool macht", {
    "type": "object",
    "properties": {"x": {"type": "string"}},
    "required": ["x"],
})           # risk=CONFIRM hinzufuegen, wenn das Tool etwas veraendert
def mein_tool(x: str) -> str:
    return "Ergebnis"
'''


def _dir() -> Path:
    return Path(context.cfg.get("plugins_dir", "~/.jarvis/plugins")).expanduser()


def load_plugins() -> list[str]:
    """Laedt (bzw. laedt neu) alle Plugins. Gibt Status-Zeilen zurueck."""
    d = _dir()
    d.mkdir(parents=True, exist_ok=True)
    status = []
    for f in sorted(d.glob("*.py")):
        source = f"plugin:{f.stem}"
        registry.unregister_source(source)
        try:
            spec = importlib.util.spec_from_file_location(f"jarvis_plugin_{f.stem}", f)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            with tool_source(source):
                spec.loader.exec_module(module)
            names = [t.name for t in registry.all() if t.source == source]
            status.append(f"OK   {f.name}: {', '.join(names) or '(keine Tools)'}")
        except Exception as e:
            registry.unregister_source(source)
            status.append(f"FEHLER {f.name}: {e}")
    return status


@tool("list_tools", "Listet alle verfuegbaren Tools inklusive Plugins auf.")
def list_tools() -> list:
    return [{"name": t.name, "quelle": t.source, "risiko": t.risk, "beschreibung": t.description[:120]}
            for t in registry.all()]


@tool(
    "create_plugin",
    "Erstellt ein neues Plugin (Python-Datei mit @tool-Funktionen) im Plugin-Ordner und laedt es sofort. "
    "Damit kannst du dir selbst neue Faehigkeiten geben. Vorlage:\n" + PLUGIN_TEMPLATE_HINT,
    {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Dateiname ohne .py, nur a-z, 0-9, _"},
            "code": {"type": "string", "description": "Vollstaendiger Python-Code des Plugins"},
        },
        "required": ["name", "code"],
    },
    risk=CONFIRM,
)
def create_plugin(name: str, code: str) -> str:
    if not re.fullmatch(r"[a-z0-9_]+", name):
        raise ValueError("Ungueltiger Name (nur a-z, 0-9, _).")
    path = _dir() / f"{name}.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(code, encoding="utf-8")
    return f"Plugin gespeichert: {path}\n" + "\n".join(load_plugins())


@tool("reload_plugins", "Laedt alle Plugins neu (nach manuellen Aenderungen).", risk=CONFIRM)
def reload_plugins() -> str:
    return "\n".join(load_plugins()) or "Keine Plugins gefunden."
