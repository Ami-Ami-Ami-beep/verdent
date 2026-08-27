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

## Modelle einhängen

Im Ordner [`resourcepack/`](resourcepack/) liegt ein fertiges Pack: Mixer in der Mitte,
Plattenspieler links und rechts, mit Texturen. Einpacken, laden, die drei Modell-Ids in die Config
eintragen — Details in der [Pack-README](resourcepack/README.md).

Ein Blockbench-Modell kommt nicht über seinen eigenen Block hinaus. Ein Pult, das breiter als ein
Block sein soll, besteht deshalb aus **mehreren Modellen nebeneinander**, die beim Aufstellen
zusammen gesetzt werden. In `config.yml`:

```yaml
model:
  material: JUKEBOX
  scale: 1.0
  y-offset: 0.5
  display-transform: NONE
  parts:
    - item-model: "djpult:dj_pult_links"
      right: -1.0
    - item-model: "djpult:dj_pult_mitte"    # Hauptteil
      right: 0.0
    - item-model: "djpult:dj_pult_rechts"
      right: 1.0
```

* `right` / `up` / `forward` sind der Versatz zur Mitte **in Blöcken, aus Sicht des Pults** — beim
  Aufstellen dreht sich die ganze Reihe mit.
* Das **mittlere Teil der Liste** ist das Hauptteil. Sein Modell zeigt auch das Item in der Hand,
  und seine Position ist der Bezugspunkt für Musik und Reichweite.
* **Jedes** Teil ist anklickbar und öffnet dieselbe Steuerung. Abbauen entfernt das ganze Pult.
* Ein Teil ohne `item-model` wird übersprungen — du kannst die Seitenteile also leer lassen, bis
  ihre Modelle fertig sind, und bekommst vorerst nur die Mitte.
* Aufgestellt wird in **90°-Schritten**, damit die Teile exakt auf Blockgrenzen sitzen.

Beim Platzieren wird geprüft, ob **alle** benötigten Blöcke frei sind — sonst kommt „Hier ist kein
Platz für das Pult".

### Modelle in Blockbench bauen

Projektformat: **Java Block/Item**. Nicht Bedrock, nicht Modded Entity — das Pult wird als *Item*
gerendert, und nur dieses Format exportiert das passende Vanilla-JSON.

* Raster **0–16 entspricht einem Block**; erlaubt ist −16 bis 32, also bis zu 3×3×3 Blöcke.
* Der **Rastermittelpunkt (8, 8, 8) sitzt auf der Entity-Position**. Deshalb `y-offset: 0.5` — damit
  steht ein blockhohes Modell genau auf dem Block statt halb im Boden.
* Ein Pult ist meist flacher als ein Block (z.B. 16 × 8 × 12). Dann `hitbox.height` entsprechend
  kleiner setzen, damit der Klickbereich zum Modell passt.
* Der **Display**-Tab steuert nur, wie das Item in Hand und Inventar aussieht. Das aufgestellte
  Pult nutzt bei `display-transform: NONE` das rohe Modell und ignoriert diese Einstellungen.
* Export über `File → Export → Export Block Model`.

**Jedes Teil ist ein eigenes Projekt** mit eigener Datei und eigenem Eintrag unter `items/`. Damit
die Teile bündig aneinander kacheln, alle im vollen Raster 0–16 bauen und die Kanten, die sich
berühren, bündig abschließen lassen.

Vor dem Export kurz prüfen:

* Kein Element doppelt an derselben Stelle — zwei identische Würfel erzeugen Z-Fighting
  (flackernde Textur).
* Der Texturpfad hat einen Namespace: `"0": "dj_pult_mitte"` sucht unter
  `assets/minecraft/textures/`, richtig ist `djpult:item/dj_pult_mitte`.

### Pack-Struktur

```
resourcepack/
├── pack.mcmeta
└── assets/djpult/
    ├── items/
    │   ├── dj_pult_links.json        <- Item-Definitionen, verweisen aufs Modell
    │   ├── dj_pult_mitte.json
    │   └── dj_pult_rechts.json
    ├── models/item/
    │   ├── dj_pult_links.json        <- die Blockbench-Modelle
    │   ├── dj_pult_mitte.json
    │   └── dj_pult_rechts.json
    └── textures/item/
        ├── dj_pult_mitte.png         <- Mixer
        └── dj_pult_seite.png         <- beide Plattenspieler
```

`assets/djpult/items/dj_pult_mitte.json`:

```json
{ "model": { "type": "minecraft:model", "model": "djpult:item/dj_pult_mitte" } }
```

Im Blockbench-Export muss der Texturpfad auf denselben Namespace zeigen:
`"textures": { "0": "djpult:item/dj_pult_mitte", "particle": "djpult:item/dj_pult_mitte" }`.

`pack.mcmeta` — seit 1.21.9 steht statt einer einzelnen `pack_format`-Zahl ein Bereich, 26.1 ist
Format 84:

```json
{ "pack": { "description": "DJPult", "min_format": 84, "max_format": 99 } }
```

Die genaue Zahl für deine Server-Version prüfst du am besten mit
<https://misode.github.io/pack-mcmeta/>.

`item-model` ist genau der Namespace-Pfad der Datei unter `items/`, hier also
`djpult:dj_pult_mitte`. Das Basis-Item (`model.material`) ist dabei egal, das Modell ersetzt das
Aussehen komplett. Für ältere Packs gibt es alternativ `custom-model-data` je Teil.

Solange kein Teil ein Modell hat, steht dort eine Jukebox — alles andere funktioniert trotzdem.

Pro Teil entstehen zwei Entities: ein `ItemDisplay` mit dem Modell und eine unsichtbare
`Interaction` als Klickbereich (`hitbox.width` / `hitbox.height`, muss zur Höhe deines Modells
passen). Die `Interaction` des Hauptteils ist das Pult: Sie hält alle Einstellungen und die Ids
der übrigen Entities in ihrem Persistent Data Container, weshalb ein Pult Chunk-Unloads und
Serverneustarts übersteht. Die übrigen Entities zeigen per Rückverweis auf sie — deshalb öffnet
jedes Teil dieselbe Steuerung.

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
3. Pult in alle vier Richtungen aufstellen — die Teile sitzen bündig und ohne Lücke nebeneinander.
4. Jedes Teil per Rechtsklick anklicken: überall öffnet dieselbe Steuerung.
5. Titel starten. Mit einem zweiten Account prüfen: Musik ist zu hören, wird beim Weglaufen leiser
   und verstummt jenseits des eingestellten Umkreises.
6. Schleichen + Rechtsklick auf ein **Randteil** — das komplette Pult verschwindet und das Item
   kommt zurück.
7. Server neu starten — das Pult steht vollständig und lässt sich weiter bedienen.
