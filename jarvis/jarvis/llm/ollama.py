"""Ollama-Backend: das Sprachmodell laeuft komplett lokal auf deinem PC.

Installation: https://ollama.com -> danach z.B. `ollama pull qwen3:14b`.
Das Modell muss Tool-Calling unterstuetzen (z.B. qwen3, llama3.1/3.3, mistral-small, gpt-oss).
"""

from __future__ import annotations

import json

import httpx

from ..tools import Tool
from . import MAX_STEPS, Executor, OnToolCall


class OllamaBackend:
    def __init__(self, model: str = "qwen3:14b", host: str = "http://localhost:11434", num_ctx: int = 32768):
        self.model = model
        self.host = host.rstrip("/")
        self.num_ctx = num_ctx
        self.messages: list[dict] = []
        self.http = httpx.Client(timeout=900)

    def reset(self) -> None:
        self.messages = []

    def chat(self, user_text: str, system: str, tools: list[Tool], execute: Executor, on_tool_call: OnToolCall) -> str:
        checkpoint = len(self.messages)
        self.messages.append({"role": "user", "content": user_text})
        tool_defs = [
            {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
            for t in tools
        ]
        for _ in range(MAX_STEPS):
            try:
                r = self.http.post(
                    f"{self.host}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [{"role": "system", "content": system}, *self.messages],
                        "tools": tool_defs,
                        "stream": False,
                        "options": {"num_ctx": self.num_ctx},
                    },
                )
            except httpx.ConnectError:
                del self.messages[checkpoint:]
                return f"Ollama ist nicht erreichbar unter {self.host}. Laeuft Ollama? (`ollama serve`)"
            r.raise_for_status()
            msg = r.json()["message"]
            msg.pop("thinking", None)
            self.messages.append(msg)

            calls = msg.get("tool_calls") or []
            if not calls:
                return (msg.get("content") or "").strip()

            for call in calls:
                fn = call["function"]
                args = fn.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                on_tool_call(fn["name"], args)
                output, is_error = execute(fn["name"], args)
                self.messages.append({
                    "role": "tool",
                    "tool_name": fn["name"],
                    "content": ("FEHLER: " if is_error else "") + output,
                })

        return "[Abgebrochen: zu viele Schritte hintereinander. Sag 'weiter', wenn ich weitermachen soll.]"
