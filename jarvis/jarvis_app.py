"""Startpunkt der Desktop-App (auch fuer PyInstaller / Jarvis.exe).

`Jarvis.exe --selftest ergebnis.txt` prueft ohne Fenster, ob alles Noetige in der .exe steckt.
"""

import os
import sys
import tempfile
import traceback


def selftest(out_path: str) -> int:
    lines = []
    try:
        os.environ["JARVIS_HOME"] = tempfile.mkdtemp(prefix="jarvis-selftest-")
        os.environ.pop("JARVIS_CONFIG", None)
        from zoneinfo import ZoneInfo

        import anthropic  # noqa: F401
        import icalendar  # noqa: F401
        import recurring_ical_events  # noqa: F401
        import webview  # noqa: F401

        from jarvis.config import EXAMPLE_CONFIG
        from jarvis.gui.app import INDEX_HTML, Api
        from jarvis.tools import registry

        ZoneInfo("Europe/Berlin")
        lines.append("Zeitzonen OK")
        assert INDEX_HTML.is_file() and EXAMPLE_CONFIG.is_file(), "Dateien fehlen"
        lines.append("Oberflaeche + Config-Vorlage OK")
        state = Api().init()
        assert state["ok"], state
        lines.append(f"Jarvis startet OK ({len(registry.all())} Tools)")
        code = 0
    except Exception:
        lines.append("FEHLER:\n" + traceback.format_exc())
        code = 1
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return code


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--selftest":
        sys.exit(selftest(sys.argv[2]))
    from jarvis.gui.app import main

    main()
