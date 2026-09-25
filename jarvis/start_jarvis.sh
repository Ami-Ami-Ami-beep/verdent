#!/usr/bin/env bash
# Startet Jarvis unter Linux/macOS. Beim ersten Start wird eine virtuelle Umgebung angelegt.
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
fi
exec .venv/bin/python -m jarvis "$@"
