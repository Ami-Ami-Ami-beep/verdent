# DJPult — Resourcepack

Die Modelle für das dreiteilige DJ-Pult. **Eine Datei fehlt noch: die Textur.**

```
resourcepack/
├── pack.mcmeta
└── assets/djpult/
    ├── items/                         Item-Definitionen (fertig)
    │   ├── dj_pult_links.json
    │   ├── dj_pult_mitte.json
    │   └── dj_pult_rechts.json
    ├── models/item/                   die Modelle (fertig)
    │   ├── dj_pult_links.json         Plattenspieler links
    │   ├── dj_pult_mitte.json         dein Mixer, korrigiert
    │   └── dj_pult_rechts.json        Plattenspieler rechts, gespiegelt
    └── textures/item/
        └── dj_pult_mitte.png          ← FEHLT, die musst du hier ablegen
```

## Was du noch tun musst

1. **`dj_pult_mitte.png` nach `assets/djpult/textures/item/` legen** — deine 32×32-Textur aus
   Blockbench. Alle drei Modelle benutzen sie gemeinsam.
2. Den Ordner `resourcepack/` als ZIP packen (die `pack.mcmeta` muss **auf oberster Ebene** im ZIP
   liegen, nicht in einem Unterordner) und in `.minecraft/resourcepacks/` ablegen.
3. In `plugins/DJPult/config.yml` eintragen:

```yaml
model:
  parts:
    - item-model: "djpult:dj_pult_links"
      right: -1.0
    - item-model: "djpult:dj_pult_mitte"
      right: 0.0
    - item-model: "djpult:dj_pult_rechts"
      right: 1.0
```

4. `/djpult reload`

## Zu den Modellen

**Mitte** ist dein Mixer, mit zwei Korrekturen:

* Das doppelte Element auf `[5,2,11] → [6,3,12]` ist raus (zwei identische Würfel an derselben
  Stelle flackern gegeneinander). 20 → 19 Elemente, dein Knopfraster ist vollständig geblieben.
* Der Texturpfad heißt jetzt `djpult:item/dj_pult_mitte` statt `dj_pult_mitte` — ohne Namespace
  hätte Minecraft unter `assets/minecraft/textures/` gesucht.

**Links und rechts** sind Plattenspieler: Grundplatte (identisch zur Mitte, damit die Reihe bündig
ist), zweistufiger Plattenteller, Spindel, Tonarm mit Lager und Tonabnehmer, Pitch-Fader,
Start/Stop und zwei kleine Tasten. Rechts ist die exakte Spiegelung von links — der Tonarm sitzt
dort auf der anderen Seite.

Die UVs greifen auf dieselben Bereiche deiner Textur zu wie dein Mixer (Deckfläche oben links,
Seitenstreifen rechts oben, Knopf-Regionen in der Mitte). Die Teile passen dadurch farblich
zusammen, haben aber noch keine eigenen Details — Plattenteller und Tonarm holst du dir am besten
in Blockbench mit ein paar Pinselstrichen heraus.

Alle drei Modelle sind darauf geprüft, dass keine zwei gleich ausgerichteten Flächen aufeinander
liegen — also kein Flackern.

## Anpassen

Die Dateien lassen sich direkt in Blockbench öffnen (`File → Open Model`). Beim Speichern schreibt
Blockbench sie im selben Format zurück.

Wenn du den Teilen später eigene Texturen geben willst, in der jeweiligen Modelldatei einfach den
`textures`-Block ändern, z.B. auf `djpult:item/dj_pult_links`.

`pack.mcmeta` steht auf Format 84 (Minecraft 26.1). Falls dein Server eine andere Version fährt,
die Zahl mit <https://misode.github.io/pack-mcmeta/> gegenprüfen.
