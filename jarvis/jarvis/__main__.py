"""Startpunkt: `python -m jarvis` - Chat im Terminal."""

from __future__ import annotations

import argparse
import json
import sys

from .agent import Jarvis
from .config import load_config
from .tools import Tool

C_DIM, C_CYAN, C_YEL, C_RST = "\033[2m", "\033[36m", "\033[33m", "\033[0m"

HELP = """Befehle:
  /neu       neues Gespraech (vergisst den Verlauf, nicht das Gedaechtnis)
  /tools     alle Tools anzeigen
  /auto      Rueckfragen fuer diese Sitzung ausschalten (Vorsicht!)
  /hilfe     diese Hilfe
  /exit      beenden"""


def _short(args: dict, limit: int = 300) -> str:
    s = json.dumps(args, ensure_ascii=False)
    return s if len(s) <= limit else s[:limit] + "..."


def ask_user(t: Tool, args: dict) -> str:
    print(f"\n{C_YEL}⚠  Jarvis moechte '{t.name}' ausfuehren:{C_RST}")
    for k, v in args.items():
        v = str(v)
        print(f"   {k}: {v if len(v) < 800 else v[:800] + ' ...'}")
    while True:
        a = input(f"{C_YEL}   Erlauben? [j]a / [n]ein / [i]mmer (diese Sitzung): {C_RST}").strip().lower()
        if a in ("j", "ja", "y", "yes"):
            return "yes"
        if a in ("n", "nein", "no", ""):
            return "no"
        if a in ("i", "immer", "a", "always"):
            return "always"


def on_tool_call(name: str, args: dict) -> None:
    print(f"{C_DIM}  → {name} {_short(args)}{C_RST}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Jarvis - dein lokaler KI-Assistent")
    parser.add_argument("-c", "--config", help="Pfad zur config.yaml")
    parser.add_argument("prompt", nargs="*", help="Einmalige Frage (ohne interaktiven Modus)")
    args = parser.parse_args()

    cfg = load_config(args.config)
    jarvis = Jarvis(cfg, ask_user, on_tool_call)
    name = cfg.get("name", "Jarvis")

    if args.prompt:
        print(jarvis.ask(" ".join(args.prompt)))
        return

    llm = cfg["llm"]
    print(f"{C_CYAN}{name} ist bereit.{C_RST} {C_DIM}(KI: {llm['provider']} / {llm[llm['provider']]['model']}, "
          f"Config: {cfg['_path'] or 'Standardwerte'}){C_RST}")
    for line in jarvis.plugin_status:
        print(f"{C_DIM}  Plugin {line}{C_RST}")
    print(f"{C_DIM}/hilfe fuer Befehle{C_RST}\n")

    while True:
        try:
            text = input(f"{C_CYAN}Du:{C_RST} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not text:
            continue
        cmd = text.lower()
        if cmd in ("/exit", "/quit", "exit", "tschuess"):
            break
        if cmd == "/hilfe":
            print(HELP)
            continue
        if cmd == "/neu":
            jarvis.reset()
            print("Neues Gespraech gestartet.")
            continue
        if cmd == "/tools":
            for t in jarvis.execute("list_tools", {})[0].splitlines():
                print(t)
            continue
        if cmd == "/auto":
            jarvis.permissions.mode = "auto"
            print("Auto-Modus an: veraendernde Aktionen laufen ohne Rueckfrage (ausser always_ask).")
            continue
        try:
            answer = jarvis.ask(text)
        except KeyboardInterrupt:
            print("\n[abgebrochen]")
            continue
        except Exception as e:
            print(f"{C_YEL}Fehler: {e}{C_RST}", file=sys.stderr)
            continue
        print(f"\n{C_CYAN}{name}:{C_RST} {answer}\n")


if __name__ == "__main__":
    main()
