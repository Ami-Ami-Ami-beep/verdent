"""KI-Backends. Jedes Backend fuehrt die Tool-Schleife selbst aus:
Modell fragen -> Tools ausfuehren -> Ergebnisse zurueckgeben -> bis fertig."""

from __future__ import annotations

from typing import Callable, Protocol

from ..tools import Tool

# execute(name, args) -> (ergebnis_text, is_error)
Executor = Callable[[str, dict], tuple[str, bool]]
# wird vor jedem Tool-Aufruf aufgerufen (fuer die Anzeige)
OnToolCall = Callable[[str, dict], None]

MAX_STEPS = 40


class Backend(Protocol):
    def chat(self, user_text: str, system: str, tools: list[Tool], execute: Executor, on_tool_call: OnToolCall) -> str:
        ...

    def reset(self) -> None:
        ...


def make_backend(cfg: dict) -> Backend:
    provider = cfg["llm"]["provider"]
    if provider == "claude":
        from .claude import ClaudeBackend

        return ClaudeBackend(**cfg["llm"]["claude"])
    if provider == "ollama":
        from .ollama import OllamaBackend

        return OllamaBackend(**cfg["llm"]["ollama"])
    raise ValueError(f"Unbekannter llm.provider: {provider!r} (erlaubt: ollama, claude)")
