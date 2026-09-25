# Jarvis – dein persönlicher KI-Assistent auf dem PC

Jarvis läuft direkt auf deinem Rechner und kann selbstständig Dinge erledigen:

| Fähigkeit | Tools |
|---|---|
| Dateien lesen, schreiben, bearbeiten, suchen | `read_file`, `write_file`, `edit_file`, `list_dir`, `search_files` |
| Programme ausführen und erstellen, Server aufsetzen | `run_command`, `start_program`, `system_info` |
| Browser-Tabs, Dateien und Ordner öffnen | `open_url`, `open_path` |
| Im Internet recherchieren (z. B. nach guten Plugins) | `web_search`, `fetch_url` |
| E-Mails checken, lesen, senden | `check_email`, `read_email`, `send_email` |
| Termine abfragen („Was habe ich diese Woche vor?“) | `get_calendar_events` |
| Sich Dinge merken | `remember`, `recall`, `forget` |
| **Sich selbst neue Fähigkeiten programmieren** | `create_plugin`, `reload_plugins`, `list_tools` |

Beispiele, was du sagen kannst:

- „Was habe ich heute und morgen für Termine?“
- „Hab ich neue Mails? Fass mir die wichtigen zusammen.“
- „Schreib mir ein Python-Skript, das meinen Downloads-Ordner nach Dateityp sortiert, und führ es aus.“
- „Richte mir einen Minecraft-Paper-Server mit guten kostenlosen Plugins ein.“
- „Bau dir ein Plugin, mit dem du meine Docker-Container überwachen kannst.“

## Als Windows-App (empfohlen)

Jarvis gibt es als normale Windows-App mit eigenem Fenster: Chat, Buttons zum Bestätigen, Einstellungen, Icon.

**Fertige `Jarvis.exe` herunterladen (ohne Python):**
1. Auf GitHub im Repo auf **Actions** → **Jarvis Windows-App** → den neuesten grünen Lauf klicken.
2. Unten bei **Artifacts** die Datei **Jarvis-Windows** herunterladen und entpacken.
3. `Jarvis.exe` starten. Windows SmartScreen warnt beim ersten Start, weil die App nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.

Beim ersten Start legt Jarvis `C:\Users\<du>\.jarvis\config.yaml` an. Über **Einstellungen** in der App kannst du sie direkt bearbeiten (Modell, E-Mail, Kalender …).

Tipp: Rechtsklick auf `Jarvis.exe` → *An Start anheften*. Für den Autostart eine Verknüpfung in den Ordner `shell:startup` legen (Win+R → `shell:startup`).

**Selbst bauen:** `build_windows.bat` doppelklicken, danach liegt die App unter `dist\Jarvis.exe`.
**Ohne Build starten:** `pip install -r requirements-app.txt`, dann `python -m jarvis.gui`.

Hinweis: In der `.exe` stecken nur die Python-Module, die Jarvis selbst nutzt, plus ein paar häufige (z. B. `psutil`, `sqlite3`, `csv`, `zipfile`). Braucht ein selbstgeschriebenes Plugin weitere Pakete, starte Jarvis aus dem Quellcode (`python -m jarvis.gui`) und installiere sie mit `pip`.

## Terminal-Version

### 1. Installation

Voraussetzung: **Python 3.10+** ([python.org](https://www.python.org/downloads/), unter Windows bei der Installation „Add to PATH“ anhaken).

```bash
cd jarvis
pip install -r requirements.txt
```

Oder einfach `start_jarvis.bat` (Windows) bzw. `./start_jarvis.sh` (Linux/macOS) starten – das legt beim ersten Mal alles automatisch an.

### 2. „Gehirn“ auswählen

Jarvis braucht ein Sprachmodell. Du hast zwei Möglichkeiten, einstellbar in `config.yaml` unter `llm.provider`:

#### a) Komplett lokal mit Ollama (kostenlos, nichts verlässt deinen PC)

1. [Ollama](https://ollama.com) installieren
2. Modell laden, passend zu deiner Grafikkarte:
   - 8 GB VRAM: `ollama pull qwen3:8b`
   - 12–16 GB VRAM: `ollama pull qwen3:14b`
   - 24 GB+ VRAM: `ollama pull qwen3:32b`
3. In `config.yaml`: `provider: ollama` und das Modell eintragen.

Lokale Modelle sind gut für Alltagsaufgaben (Termine, Mails, Dateien, kleine Skripte). Bei großen Aufgaben wie „bau mir ein komplettes Serversystem“ stoßen sie aber schneller an ihre Grenzen.

#### b) Claude API (deutlich stärker bei großen Aufgaben)

1. API-Key auf [console.anthropic.com](https://console.anthropic.com) erstellen
2. Als Umgebungsvariable setzen:
   - Windows (PowerShell): `setx ANTHROPIC_API_KEY "sk-ant-..."` (danach Terminal neu öffnen)
   - Linux/macOS: `export ANTHROPIC_API_KEY="sk-ant-..."`
3. In `config.yaml`: `provider: claude`

Jarvis und alle Tools laufen trotzdem auf deinem PC, nur das „Denken“ passiert bei Anthropic. Die Abrechnung erfolgt pro Nutzung. Lehnt das Modell eine Anfrage ab, übernimmt automatisch ein Ersatzmodell (Server-Side-Fallback).

### 3. Einrichten

```bash
cp jarvis/config.example.yaml config.yaml     # Windows: copy jarvis\config.example.yaml config.yaml
```

Dann `config.yaml` anpassen:

- **E-Mail**: Server und Adresse eintragen. Das Passwort gehört in eine Umgebungsvariable, nicht in die Datei:
  `setx JARVIS_EMAIL_PASSWORD "deinPasswort"`.
  Bei t-online brauchst du dafür das separate **E-Mail-Passwort** aus dem Kundencenter. Bei Gmail brauchst du ein **App-Passwort**.
- **Kalender**: Den privaten iCal-Link deines Kalenders unter `calendar.ics_urls` eintragen.
  Google Kalender: Einstellungen → dein Kalender → „Privatadresse im iCal-Format“.
- **Berechtigungen**: siehe unten.
- **Budget**: `free` = nur kostenlose Lösungen, `budget` = Jarvis darf Käufe bis `max_eur` vorschlagen.

### 4. Starten

```bash
python -m jarvis                          # Chat
python -m jarvis "Was steht heute an?"    # einmalige Frage
```

Befehle im Chat: `/neu`, `/tools`, `/auto`, `/hilfe`, `/exit`.

## Sicherheit und Berechtigungen

Jarvis kann **alles**, was du am PC auch kannst, also auch Dateien löschen oder Programme installieren. Deshalb gibt es Stufen:

- **Lesen** (Dateien, Mails, Kalender, Websuche) läuft immer ohne Rückfrage.
- **Verändern** (schreiben, Befehle, Programme, Tabs, Plugins) fragt nach: `[j]a / [n]ein / [i]mmer`.
- `permissions.mode: auto` schaltet die Rückfragen ab. Das ist bequem, aber riskant, nutze es nur, wenn du weißt, was du tust.
- `always_ask` (Standard: `send_email`) fragt **immer** nach, auch im Auto-Modus.
- **Geld ausgeben**: Jarvis kauft **nie** selbst etwas ein und gibt keine Zahlungsdaten ein. Im Budget-Modus sucht er passende Produkte heraus (Preis, Link, Begründung, kostenlose Alternativen), und den Kauf machst du selbst.
- Inhalte aus E-Mails und Webseiten behandelt Jarvis als Daten, nicht als Befehle. Trotzdem gilt: Eine präparierte Mail oder Webseite *könnte* versuchen, ihn zu manipulieren. Auch deshalb gibt es die Rückfragen.

## Eigene Plugins

Plugins sind Python-Dateien in `~/.jarvis/plugins/`. Ein Beispiel liegt in `plugins_example/wetter.py`:

```python
from jarvis.tools import tool

@tool("weather", "Aktuelles Wetter für einen Ort.",
      {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]})
def weather(city: str) -> dict:
    ...
```

Jarvis kann solche Plugins auch selbst schreiben („Bau dir ein Tool für …“) und lädt sie sofort.

## Projektstruktur

```
jarvis/
├── jarvis/
│   ├── __main__.py      Terminal-Chat
│   ├── gui/             Desktop-App (Fenster + Chat-Oberfläche)
│   ├── agent.py         System-Prompt, Berechtigungen
│   ├── config.py        Konfiguration
│   ├── llm/             Ollama- und Claude-Backend (Tool-Schleife)
│   └── tools/           alle eingebauten Tools + Plugin-System
│   └── config.example.yaml
├── jarvis_app.py        Startpunkt der App / Jarvis.exe
├── jarvis.spec          Build-Rezept für die .exe (PyInstaller)
├── build_windows.bat    .exe selbst bauen
├── plugins_example/     Beispiel-Plugin
└── tests/               pytest-Tests
```

Tests: `pip install -r requirements-dev.txt && pytest`

## Ideen für die nächsten Schritte

- **Sprachsteuerung**: Wake-Word „Jarvis“ plus Spracherkennung (z. B. `faster-whisper`, läuft lokal) und Sprachausgabe (z. B. `piper`)
- **Tray-Icon** und globaler Hotkey, um Jarvis jederzeit aufzurufen
- **Kalender schreiben**: Termine per CalDAV oder Google-Calendar-API anlegen
- **Browser-Steuerung**: mit Playwright Webseiten richtig bedienen (klicken, Formulare ausfüllen)
- **Server-Management**: SSH-Plugin für deine Server, Monitoring, Backups
- **Proaktiv**: morgens automatisch Termine und Mails zusammenfassen
