# ReelStudio – Claude + Remotion

Reels ohne Schnittprogramm: Claude schreibt das Skript und baut jede Szene als Code, [Remotion](https://www.remotion.dev) rendert daraus ein MP4 – jede Animation sitzt genau auf dem gesprochenen Wort.

## Werkzeuge

| Rolle      | Werkzeug                              |
|------------|---------------------------------------|
| Texter     | Claude                                |
| Animator   | Claude Code + Remotion (dieses Projekt) |
| Avatar/Stimme | HeyGen o. ä. – oder selbst einsprechen (optional) |
| Zeitstempel | Whisper (OpenAI API)                  |
| Musik      | beliebige MP3 (optional)              |

## Schnellstart

```bash
cd reelstudio
npm install
npm run studio          # Vorschau im Browser (Remotion Studio)
npm run render -- demo  # → out/demo.mp4
```

## Eigenes Reel

Am einfachsten: Claude Code in diesem Ordner öffnen und schreiben **„Neues Reel: <Thema>“**. Claude folgt dem Ablauf in [`CLAUDE.md`](CLAUDE.md) (Fragen → 5 Skripte → Auswahl → Szenen → Rendern).

Von Hand:

```bash
mkdir reels/mein-reel
# script.txt schreiben, reel.json mit "scenes" anlegen (Vorlage: reels/demo/reel.json)

npm run timing -- mein-reel       # Vorschau-Zeiten aus dem Text schätzen
# … oder mit echter Aufnahme reels/mein-reel/voice.mp3:
OPENAI_API_KEY=sk-... npm run transcribe -- mein-reel

npm run render -- mein-reel       # → out/mein-reel.mp4
```

In `reel.json` dann `"audio": "voice.mp3"` (bzw. `"avatar": "avatar.mp4"`, `"music": "music.mp3"`) eintragen.

### Hinweise

- Ohne OpenAI-Key geht Whisper auch lokal, z. B. mit [`@remotion/install-whisper-cpp`](https://www.remotion.dev/docs/install-whisper-cpp); die Wörter müssen nur als `{ "text", "start", "end" }` in `reel.json` landen.
- Remotion lädt beim ersten Rendern einen Headless-Chrome. Ist der Download blockiert, eigenen Browser angeben: `REMOTION_BROWSER=/pfad/zu/chrome-headless-shell npm run render -- demo`.
- Remotion ist für Einzelpersonen und kleine Firmen kostenlos; größere Firmen brauchen eine Lizenz ([Bedingungen](https://www.remotion.dev/license)).
