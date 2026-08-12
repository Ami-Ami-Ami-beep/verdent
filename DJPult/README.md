# DJPult

Ein Paper-Plugin, das ein platzierbares **DJ-Pult** ins Spiel bringt. Rechtsklick öffnet ein GUI,
aus dem du Songs startest — und **alle Spieler im Umkreis hören die Musik synchron mit**, leiser je
weiter sie weg stehen.

* Server: **Paper 26.x** (`api-version: '26'`, Java 25)
* Musik: **.nbs**-Songs aus [Open Note Block Studio](https://noteblock.studio) — kein zweites
  Plugin, keine Sound-Dateien im Resourcepack nötig
* Modell: dein eigenes Resourcepack-Modell, über die Config eingehängt

---

## Installation

1. `DJPult-1.0.0.jar` nach `plugins/` legen und den Server starten.
2. `.nbs`-Dateien nach `plugins/DJPult/songs/` kopieren.
3. `/djpult reload` — die Titel stehen sofort im GUI.

Ohne eigene Songs bietet das Plugin einen kurzen eingebauten Demo-Loop an, damit du sofort testen
kannst.

## Bedienung

| Aktion | Wie |
|---|---|
| Pult-Item bekommen | `/djpult give` |
| Pult aufstellen | Mit dem Item auf einen Block rechtsklicken |
| Steuerung öffnen | Rechtsklick auf das Pult |
| Pult abbauen | **Schleichen + Rechtsklick** (oder draufschlagen) |

Im GUI: Titelliste (blätterbar), Play/Pause, Stopp, vor/zurück, Wiederholen, Zufall, Lautstärke
und Umkreis. Der Fortschrittsbalken läuft live mit.

Wer mitten im Song in den Umkreis läuft, steigt **an der aktuellen Stelle** ein — es startet nicht
für jeden von vorn.

## Befehle und Rechte

| Befehl | Recht | Wirkung |
|---|---|---|
| `/djpult give [Spieler]` | `djpult.admin` | Pult-Item geben |
| `/djpult list` | `djpult.use` | Geladene Titel anzeigen |
| `/djpult play <titel>` | `djpult.use` | Titel auf dem nächsten Pult starten |
| `/djpult stop` | `djpult.use` | Nächstes Pult stoppen |
| `/djpult stopall` | `djpult.admin` | Alle Pulte stoppen |
| `/djpult reload` | `djpult.admin` | Config und Songs neu laden |

Alias: `/dj`.

| Recht | Standard | Bedeutung |
|---|---|---|
| `djpult.use` | alle | Pulte bedienen |
| `djpult.place` | alle | Pulte aufstellen |
| `djpult.admin` | OP | Items vergeben, fremde Pulte abbauen, neu laden |

Abbauen darf grundsätzlich nur, wer das Pult aufgestellt hat — oder ein Admin. Mit
`behaviour.restrict-controls-to-owner: true` gilt das auch fürs Bedienen.

## Eigenes Modell einhängen

Das Plugin bringt **kein** Resourcepack mit, es verweist nur darauf. In `config.yml`:

```yaml
model:
  material: JUKEBOX
  item-model: "djpult:dj_pult"
  scale: 1.0
  y-offset: 0.5
  display-transform: NONE
```

Dazu im Resourcepack (Format seit 1.21.4 / 26.x):

```
assets/djpult/items/dj_pult.json      -> { "model": { "type": "minecraft:model", "model": "djpult:item/dj_pult" } }
assets/djpult/models/item/dj_pult.json -> dein Blockbench-Modell
assets/djpult/textures/item/dj_pult.png
```

`item-model` ist genau der Namespace-Pfad der Datei unter `items/`, hier also `djpult:dj_pult`.
Für ältere Packs gibt es alternativ `model.custom-model-data`.

Solange `item-model` leer ist, sieht das Pult wie eine Jukebox aus — alles andere funktioniert
trotzdem.

Das Pult besteht aus zwei Entities: einem `ItemDisplay`, das dein Modell zeigt, und einer
unsichtbaren `Interaction` mit der Klick-Hitbox (`hitbox.width` / `hitbox.height`). Der komplette
Zustand liegt im Persistent Data Container der `Interaction`, ein Pult übersteht damit
Chunk-Unloads und Serverneustarts.

## Wie die Musik ausgespielt wird

`.nbs`-Songs bestehen aus Note-Block-Noten. Das Plugin liest die Datei selbst ein und schickt pro
Song-Tick die passenden `block.note_block.*`-Sounds an jeden Zuhörer.

* **Radius statt Client-Dämpfung:** Der Client hört einen Sound nur 16 Blöcke × Lautstärke weit.
  Deshalb wird der Sound nicht am Pult abgespielt, sondern einen halben Block vor dem jeweiligen
  Zuhörer, mit einer Lautstärke, die das Plugin selbst ausrechnet: voll am Pult, linear auf 0 am
  Rand des eingestellten Umkreises. Die Richtung bleibt hörbar, der Umkreis stimmt exakt.
* **Tempo:** NBS-Songs laufen mit eigenem Tempo (z.B. 10 Ticks/Sekunde), der Server mit 20. Ein
  einziger Task pro Server-Tick rechnet das um, statt pro Pult einen eigenen Timer zu starten.
* **Tonumfang:** Note-Blöcke können nur die Tasten 33–57 spielen. Tiefere und höhere Noten werden
  oktavweise hineingeschoben (`audio.transpose-out-of-range`), statt zu verschwinden.
* **Stereo:** Layer-Stereo und Noten-Panning verschieben den Sound leicht nach links oder rechts
  (`audio.stereo`).
* **Custom-Instrumente:** Songs mit eigenen Samples brauchen ein Resourcepack mit den passenden
  Sounds. Fehlt es, greift `audio.custom-instrument-fallback`.

Am Songende gilt: `Wiederholen` an → derselbe Titel nochmal; sonst `Zufall` an → zufälliger
nächster Titel; sonst Stopp.

## Selbst bauen

```bash
cd DJPult
./gradlew build
```

Ergebnis: `build/libs/DJPult-1.0.0.jar`. Gebraucht wird JDK 25 (Paper 26.x). Der Workflow
`.github/workflows/build.yml` baut dieselbe Jar bei jedem Push und hängt sie als Artifact an.

Tests (`./gradlew test`) decken den NBS-Parser und die Pitch-/Lautstärke-Mathematik ab.

## Test im Spiel

1. Paper 26.x starten, Jar installieren, ein paar `.nbs` nach `plugins/DJPult/songs/`.
2. `/djpult reload`, dann `/djpult give`.
3. Pult aufstellen, Rechtsklick, Titel anklicken.
4. Mit einem zweiten Account prüfen: Musik ist zu hören, wird beim Weglaufen leiser und verstummt
   jenseits des eingestellten Umkreises.
5. Server neu starten — das Pult steht noch und lässt sich weiter bedienen.
