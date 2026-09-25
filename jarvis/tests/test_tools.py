from datetime import datetime, timedelta
from pathlib import Path

import httpx

from jarvis.agent import Jarvis, Permissions
from jarvis.llm.ollama import OllamaBackend
from jarvis.tools import registry
from jarvis.tools.calendar import get_calendar_events

ALLOW = lambda t, a: True  # noqa: E731
DENY = lambda t, a: False  # noqa: E731


def test_builtin_tools_registered():
    names = {t.name for t in registry.all()}
    for n in ["read_file", "write_file", "run_command", "open_url", "check_email",
              "get_calendar_events", "web_search", "remember", "create_plugin"]:
        assert n in names


def test_write_needs_approval(cfg, tmp_path):
    target = tmp_path / "a" / "b.txt"
    out, err = registry.execute("write_file", {"path": str(target), "content": "hi"}, DENY)
    assert err and not target.exists()
    out, err = registry.execute("write_file", {"path": str(target), "content": "hi"}, ALLOW)
    assert not err and target.read_text() == "hi"
    out, err = registry.execute("read_file", {"path": str(target)}, DENY)  # lesen ist "safe"
    assert out == "hi"


def test_edit_and_search(cfg, tmp_path):
    f = tmp_path / "x.py"
    f.write_text("print('alt')\n")
    registry.execute("edit_file", {"path": str(f), "old_text": "alt", "new_text": "neu"}, ALLOW)
    assert "neu" in f.read_text()
    out, _ = registry.execute("search_files", {"root": str(tmp_path), "pattern": "*.py", "contains": "neu"}, ALLOW)
    assert "x.py:1" in out


def test_errors_are_returned_not_raised(cfg):
    out, err = registry.execute("read_file", {"path": "/gibt/es/nicht"}, ALLOW)
    assert err and "Fehler" in out
    out, err = registry.execute("read_file", {}, ALLOW)
    assert err and "Fehlende Parameter" in out
    out, err = registry.execute("nope", {}, ALLOW)
    assert err


def test_run_command(cfg):
    out, err = registry.execute("run_command", {"command": "echo jarvis"}, ALLOW)
    assert not err and "jarvis" in out and "Exit-Code: 0" in out


def test_permissions(cfg):
    asked = []
    perms = Permissions(cfg, lambda t, a: asked.append(t.name) or "always")
    write = registry.get("write_file")
    assert perms(write, {}) and asked == ["write_file"]
    assert perms(write, {}) and asked == ["write_file"]  # "immer" -> nicht nochmal fragen
    perms.mode = "auto"
    assert perms(registry.get("send_email"), {}) and asked[-1] == "send_email"  # always_ask gilt trotzdem
    assert perms(registry.get("read_file"), {}) and len(asked) == 2


def test_memory(cfg):
    registry.execute("remember", {"text": "Server laeuft auf 192.168.1.20"}, ALLOW)
    out, _ = registry.execute("recall", {"query": "server"}, ALLOW)
    assert "192.168.1.20" in out


def test_calendar_from_ics(cfg, tmp_path):
    start = datetime.now().replace(hour=15, minute=0, second=0, microsecond=0) + timedelta(days=1)
    ics = tmp_path / "cal.ics"
    ics.write_text(
        "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:test\n"
        f"BEGIN:VEVENT\nUID:1\nSUMMARY:Zahnarzt\nDTSTART:{start:%Y%m%dT%H%M%S}\n"
        f"DTEND:{start + timedelta(hours=1):%Y%m%dT%H%M%S}\nLOCATION:Praxis\nEND:VEVENT\n"
        "BEGIN:VEVENT\nUID:2\nSUMMARY:Training\nDTSTART:20200106T180000\nDTEND:20200106T190000\n"
        "RRULE:FREQ=DAILY\nEND:VEVENT\nEND:VCALENDAR\n"
    )
    cfg["calendar"]["ics_files"] = [str(ics)]
    events = get_calendar_events(days=3)
    titles = [e["titel"] for e in events]
    assert "Zahnarzt" in titles
    assert titles.count("Training") == 3  # Serientermin wird aufgeloest
    assert any(e.get("ort") == "Praxis" for e in events)


def test_create_plugin(cfg):
    code = (
        "from jarvis.tools import tool\n"
        "@tool('verdoppeln', 'x*2', {'type':'object','properties':{'x':{'type':'integer'}},'required':['x']})\n"
        "def verdoppeln(x):\n    return str(x * 2)\n"
    )
    out, err = registry.execute("create_plugin", {"name": "mathe", "code": code}, ALLOW)
    assert not err and "OK" in out
    assert registry.get("verdoppeln").source == "plugin:mathe"
    assert registry.execute("verdoppeln", {"x": 21}, ALLOW) == ("42", False)
    registry.unregister_source("plugin:mathe")


def test_ollama_tool_loop(cfg, tmp_path):
    """Simuliert Ollama: erst ein Tool-Aufruf, dann die finale Antwort."""
    note = tmp_path / "notiz.txt"
    note.write_text("Einkaufen: Milch")
    replies = iter([
        {"message": {"role": "assistant", "content": "",
                     "tool_calls": [{"function": {"name": "read_file", "arguments": {"path": str(note)}}}]}},
        {"message": {"role": "assistant", "content": "Du musst Milch kaufen."}},
    ])
    seen = []

    def handler(request):
        seen.append(request.read())
        return httpx.Response(200, json=next(replies))

    jarvis = Jarvis(cfg, lambda t, a: "yes", lambda n, a: None)
    backend = OllamaBackend()
    backend.http = httpx.Client(transport=httpx.MockTransport(handler))
    jarvis.backend = backend

    assert jarvis.ask("Was steht in meiner Notiz?") == "Du musst Milch kaufen."
    assert b"Einkaufen: Milch" in seen[1]  # Tool-Ergebnis ging zurueck ans Modell
    assert Path(cfg["workspace"]).is_dir()


def test_example_plugin_loads(cfg):
    import shutil

    from jarvis.tools.plugins import load_plugins

    Path(cfg["plugins_dir"]).mkdir(parents=True)
    shutil.copy(Path(__file__).parent.parent / "plugins_example" / "wetter.py", cfg["plugins_dir"])
    status = load_plugins()
    assert status == ["OK   wetter.py: weather"]
    registry.unregister_source("plugin:wetter")
