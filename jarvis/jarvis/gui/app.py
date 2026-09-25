"""Desktop-App: Jarvis in einem eigenen Fenster (unter Windows ueber Edge WebView2).

Start: `python -m jarvis.gui` oder die gebaute Jarvis.exe.
"""

from __future__ import annotations

import itertools
import json
import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

import yaml

from ..agent import Jarvis
from ..config import ensure_user_config, load_config
from ..tools import Tool

INDEX_HTML = Path(__file__).parent / "index.html"


class Api:
    """Wird dem JavaScript im Fenster als window.pywebview.api bereitgestellt.

    Attribute mit _ sind fuer JavaScript unsichtbar.
    """

    def __init__(self):
        self._window = None
        self._jarvis: Jarvis | None = None
        self._cfg: dict = {}
        self._pending: dict[int, list] = {}
        self._ids = itertools.count(1)
        self._busy = False
        self._lock = threading.Lock()

    # ---------- Python -> JavaScript ----------

    def _emit(self, kind: str, **data) -> None:
        if self._window is not None:
            self._window.run_js(f"window.jarvisEvent({json.dumps({'kind': kind, **data}, ensure_ascii=False)})")

    def _ask_user(self, t: Tool, args: dict) -> str:
        """Wird im Arbeits-Thread aufgerufen und wartet, bis im Fenster geklickt wurde."""
        approval_id = next(self._ids)
        done = threading.Event()
        self._pending[approval_id] = [done, "no"]
        self._emit("approval", id=approval_id, tool=t.name, description=t.description,
                   args={k: str(v)[:3000] for k, v in args.items()})
        done.wait()
        return self._pending.pop(approval_id)[1]

    def _on_tool_call(self, name: str, args: dict) -> None:
        s = json.dumps(args, ensure_ascii=False)
        self._emit("tool", name=name, args=s if len(s) < 300 else s[:300] + "...")

    # ---------- JavaScript -> Python ----------

    def init(self) -> dict:
        """(Neu) starten mit der aktuellen Config. Gibt Status fuers Fenster zurueck."""
        try:
            path = ensure_user_config()
            self._cfg = load_config(str(path))
            self._jarvis = Jarvis(self._cfg, self._ask_user, self._on_tool_call)
        except Exception as e:
            self._jarvis = None
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}
        llm = self._cfg["llm"]
        return {
            "ok": True,
            "name": self._cfg.get("name", "Jarvis"),
            "user": self._cfg.get("user_name", ""),
            "provider": llm["provider"],
            "model": llm.get(llm["provider"], {}).get("model", ""),
            "auto": self._cfg["permissions"].get("mode") == "auto",
            "plugins": self._jarvis.plugin_status,
            "config_path": self._cfg["_path"],
        }

    def send(self, text: str) -> bool:
        with self._lock:
            if self._busy or self._jarvis is None or not text.strip():
                return False
            self._busy = True
        threading.Thread(target=self._run, args=(text,), daemon=True).start()
        return True

    def _run(self, text: str) -> None:
        try:
            self._emit("answer", text=self._jarvis.ask(text))
        except Exception as e:
            self._emit("error", text=f"{type(e).__name__}: {e}")
        finally:
            self._busy = False
            self._emit("idle")

    def answer_approval(self, approval_id: int, answer: str) -> None:
        slot = self._pending.get(int(approval_id))
        if slot:
            slot[1] = answer if answer in ("yes", "no", "always") else "no"
            slot[0].set()

    def new_chat(self) -> bool:
        if self._busy or self._jarvis is None:
            return False
        self._jarvis.reset()
        return True

    def set_auto(self, enabled: bool) -> None:
        if self._jarvis:
            self._jarvis.permissions.mode = "auto" if enabled else "ask"

    def get_config(self) -> dict:
        path = ensure_user_config()
        return {"path": str(path), "text": path.read_text(encoding="utf-8")}

    def save_config(self, text: str) -> dict:
        if self._busy:
            return {"ok": False, "error": "Jarvis arbeitet gerade - bitte warten."}
        try:
            yaml.safe_load(text)
        except yaml.YAMLError as e:
            return {"ok": False, "error": f"Fehler in der Config:\n{e}"}
        ensure_user_config().write_text(text, encoding="utf-8")
        return self.init()

    def open_link(self, url: str) -> None:
        if url.startswith(("http://", "https://")):
            webbrowser.open_new_tab(url)

    def open_folder(self, which: str) -> None:
        folders = {
            "config": str(ensure_user_config().parent),
            "workspace": self._cfg.get("workspace", str(Path.home())),
            "plugins": self._cfg.get("plugins_dir", str(Path.home())),
        }
        path = folders.get(which)
        if not path:
            return
        Path(path).mkdir(parents=True, exist_ok=True)
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])


def _show_fatal(message: str) -> None:
    """Fehler beim Start sichtbar machen (ohne Konsole sieht man sonst nichts)."""
    log = Path.home() / ".jarvis" / "error.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(message, encoding="utf-8")
    if sys.platform.startswith("win"):
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, f"{message[-1500:]}\n\nDetails: {log}", "Jarvis konnte nicht starten", 0x10)
    else:
        print(message, file=sys.stderr)


def main() -> None:
    try:
        _run_window()
    except Exception:
        import traceback

        _show_fatal(traceback.format_exc())
        raise SystemExit(1)


def _run_window() -> None:
    import webview

    api = Api()
    window = webview.create_window(
        "Jarvis",
        url=str(INDEX_HTML),
        js_api=api,
        width=1000,
        height=760,
        min_size=(520, 480),
        background_color="#0b1016",
        text_select=True,
    )
    api._window = window
    webview.start()


if __name__ == "__main__":
    main()
