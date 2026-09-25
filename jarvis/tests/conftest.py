import pytest

from jarvis.config import load_config
from jarvis.tools import context


@pytest.fixture
def cfg(tmp_path, monkeypatch):
    monkeypatch.setenv("JARVIS_CONFIG", str(tmp_path / "none.yaml"))
    monkeypatch.chdir(tmp_path)
    c = load_config()
    c["workspace"] = str(tmp_path / "ws")
    c["plugins_dir"] = str(tmp_path / "plugins")
    c["memory_file"] = str(tmp_path / "memory.json")
    context.configure(c)
    return c
