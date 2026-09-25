"""Tests fuer die App-Logik (ohne echtes Fenster)."""

import json
import threading
import time

from jarvis.gui.app import INDEX_HTML, Api


class FakeWindow:
    def __init__(self, api):
        self.api = api
        self.events = []
        self.got_event = threading.Condition()

    def run_js(self, script):
        assert script.startswith("window.jarvisEvent(") and script.endswith(")")
        event = json.loads(script[len("window.jarvisEvent("):-1])
        with self.got_event:
            self.events.append(event)
            self.got_event.notify_all()
        if event["kind"] == "approval":  # Benutzer klickt "Erlauben"
            threading.Thread(target=self.api.answer_approval, args=(event["id"], "yes")).start()

    def wait_for(self, kind, timeout=5):
        deadline = time.time() + timeout
        with self.got_event:
            while not any(e["kind"] == kind for e in self.events):
                assert self.got_event.wait(deadline - time.time()), f"kein {kind}-Event"


class ScriptedBackend:
    """Ruft einmal write_file auf (braucht Bestaetigung) und antwortet dann."""

    def __init__(self, target):
        self.target = target

    def chat(self, user_text, system, tools, execute, on_tool_call):
        args = {"path": str(self.target), "content": user_text}
        on_tool_call("write_file", args)
        out, err = execute("write_file", args)
        return f"fertig: {out}"

    def reset(self):
        pass


def test_index_html_exists():
    assert INDEX_HTML.is_file()
    assert "pywebviewready" in INDEX_HTML.read_text(encoding="utf-8")


def test_init_creates_config_and_chat_with_approval(cfg, tmp_path, monkeypatch):
    monkeypatch.setenv("JARVIS_CONFIG", "")
    monkeypatch.setattr("jarvis.config.JARVIS_HOME", tmp_path / "home")
    api = Api()
    window = FakeWindow(api)
    api._window = window

    state = api.init()
    assert state["ok"], state
    assert (tmp_path / "home" / "config.yaml").is_file()  # Vorlage wurde angelegt

    target = tmp_path / "out.txt"
    api._jarvis.backend = ScriptedBackend(target)
    assert api.send("Hallo Datei") is True
    window.wait_for("idle")

    kinds = [e["kind"] for e in window.events]
    assert kinds == ["tool", "approval", "answer", "idle"]
    assert target.read_text() == "Hallo Datei"
    assert window.events[1]["tool"] == "write_file"


def test_save_config_rejects_invalid_yaml(cfg, tmp_path, monkeypatch):
    monkeypatch.setenv("JARVIS_CONFIG", "")
    monkeypatch.setattr("jarvis.config.JARVIS_HOME", tmp_path / "home")
    api = Api()
    r = api.save_config("llm: [kaputt")
    assert not r["ok"] and "Fehler in der Config" in r["error"]
    r = api.save_config("name: Friday\nllm:\n  provider: gibtsnicht\n")
    assert not r["ok"] and "gibtsnicht" in r["error"]  # startet nicht, zeigt Fehler
    assert api.get_config()["text"].startswith("name: Friday")
