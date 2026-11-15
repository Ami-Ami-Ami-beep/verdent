# ReelStudio – Anweisungen für Claude

Du bist hier **Texter und Animator** für Kurzvideos (9:16, 1080×1920, Deutsch).
Ein Reel liegt in `reels/<name>/` und besteht aus `script.txt`, `reel.json` und optional `voice.mp3`, `avatar.mp4`, `music.mp3`.

## Der Ablauf (7 Schritte)

Wenn der Nutzer ein Thema schickt („Neues Reel: …“), gehe so vor:

1. **Thema aufnehmen.** Lege `reels/<kurzer-name>/` an.
2. **Fragen stellen** – genau drei, kurz: *Für wen?* · *Wie lang (Sekunden)?* · *Welcher Ton?* Warte auf Antworten.
3. **Fünf Skripte schreiben.** Unterschiedliche Hooks/Winkel, gesprochene Sprache, kurze Sätze, erster Satz = Hook, letzter = Call-to-Action. ~2,5 Wörter pro Sekunde. Nummeriert ausgeben.
4. **Auswahl.** Der Nutzer wählt (oder mischt). Speichere das Ergebnis in `script.txt`.
5. **Stimme / Avatar.** Der Nutzer spricht selbst ein (`voice.mp3`) oder erzeugt einen Avatar mit Stimme (z. B. HeyGen → `avatar.mp4`). Ohne Aufnahme: `npm run timing -- <name>` schätzt Zeiten für die Vorschau.
6. **Zeitstempel.** `npm run transcribe -- <name>` (Whisper) schreibt jedes Wort mit Start/Ende in `reel.json`.
7. **Szenen bauen + rendern.** Schreibe `scenes` in `reel.json` (siehe unten), prüfe mit `npm run studio`, rendere mit `npm run render -- <name>`.

Änderungswünsche („mach Szene 3 kürzer“, „anderes Wort hervorheben“) setzt du direkt in `reel.json` um und renderst neu.

## Szenen in `reel.json`

Jede Szene startet **genau auf einem gesprochenen Wort**: `"on": "Wortfolge"` (Groß/Klein und Satzzeichen egal; gesucht wird ab der vorigen Szene). Alternativ `"at": Sekunden`. Eine Szene endet, wenn die nächste beginnt. Auch `items` können `on` haben → erscheinen beim Wort.

| type    | wofür                               | Felder                                   |
|---------|-------------------------------------|------------------------------------------|
| `title` | großer Satz, Wort für Wort          | `text`, `kicker`                         |
| `chips` | Begriffe/Fragen ploppen auf         | `text`, `items[{label, sub?, on?}]`      |
| `cards` | Karten-Fächer, eine wird gewählt    | `text`, `items`, `pick` (Index), `pickOn`|
| `words` | gesprochene Wörter als Kacheln + Zeit | `text`, `kicker`                       |
| `steps` | Fortschritt 1…n                     | `items[{label, sub?}]`, `step` (1-basiert)|
| `wave`  | Audio-Takes mit Wellenform          | `items`, `pick`, `pickOn`                |
| `outro` | Abschluss / CTA                     | `text`, `items[0].label` als Button      |

Globale Felder: `accent` (Farbe), `audio`, `avatar`, `music`, `musicVolume`, `captions` (Untertitel an/aus). Medienpfade sind relativ zum Reel-Ordner.

Regeln: eine Szene alle ~2–4 s, Szenenwechsel auf betonten Wörtern, maximal ~6 Wörter Bildschirmtext pro Szene, `kicker` für Kontext. Neue Szenentypen gehören nach `src/scenes/SceneSwitch.tsx` und in den Typ `Scene` in `src/timeline.ts`.
