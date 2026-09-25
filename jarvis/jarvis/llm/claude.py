"""Claude-Backend ueber das offizielle Anthropic-SDK.

API-Key: Umgebungsvariable ANTHROPIC_API_KEY (oder `ant auth login`).
"""

from __future__ import annotations

import anthropic

from ..tools import Tool
from . import MAX_STEPS, Executor, OnToolCall


class ClaudeBackend:
    def __init__(self, model: str = "claude-opus-5", effort: str = "high"):
        self.client = anthropic.Anthropic()
        self.model = model
        self.effort = effort
        self.messages: list[dict] = []

    def reset(self) -> None:
        self.messages = []

    def chat(self, user_text: str, system: str, tools: list[Tool], execute: Executor, on_tool_call: OnToolCall) -> str:
        checkpoint = len(self.messages)
        self.messages.append({"role": "user", "content": user_text})
        tool_defs = [{"name": t.name, "description": t.description, "input_schema": t.parameters} for t in tools]

        for _ in range(MAX_STEPS):
            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=system,
                tools=tool_defs,
                messages=self.messages,
                thinking={"type": "adaptive"},
                output_config={"effort": self.effort},
                cache_control={"type": "ephemeral"},
                # Lehnt das Modell ab, springt serverseitig automatisch ein passendes Ersatzmodell ein.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            text = "".join(b.text for b in response.content if b.type == "text").strip()

            if response.stop_reason == "refusal":
                del self.messages[checkpoint:]
                return "Das kann ich leider nicht machen." + (f"\n{text}" if text else "")
            if response.stop_reason == "max_tokens":
                del self.messages[checkpoint:]
                return (text + "\n\n" if text else "") + "[Antwort war zu lang und wurde abgebrochen - bitte Aufgabe aufteilen.]"

            self.messages.append({"role": "assistant", "content": response.content})
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if response.stop_reason != "tool_use" or not tool_uses:
                return text

            results = []
            for block in tool_uses:
                on_tool_call(block.name, block.input)
                output, is_error = execute(block.name, block.input)
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": output, "is_error": is_error})
            # Alle Ergebnisse in EINER Nachricht zurueck
            self.messages.append({"role": "user", "content": results})

        return "[Abgebrochen: zu viele Schritte hintereinander. Sag 'weiter', wenn ich weitermachen soll.]"
