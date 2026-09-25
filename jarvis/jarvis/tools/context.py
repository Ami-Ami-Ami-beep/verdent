"""Gemeinsamer Zustand fuer Tools (aktuelle Konfiguration)."""

from __future__ import annotations

cfg: dict = {}


def configure(config: dict) -> None:
    cfg.clear()
    cfg.update(config)
