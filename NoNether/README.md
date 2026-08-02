# NoNether

Paper-Plugin, das das **Betreten des Nethers** verhindert. Portale bleiben
erhalten: sie können weiterhin gebaut und angezündet werden, nur der Teleport
in den Nether wird abgebrochen. Wer schon im Nether ist, bleibt dort und kann
normal wieder heraus.

## Anforderungen

- Paper 1.21+ (moderne Paper-API, läuft **nicht** auf reinem Spigot/Bukkit)
- Java 21

## Bauen

```bash
cd NoNether
mvn clean package
```

Das fertige Plugin liegt danach unter `target/NoNether-1.0.0.jar` und wird in
den `plugins/`-Ordner des Servers kopiert.

## Was blockiert wird

| Situation | Verhalten |
|---|---|
| Spieler läuft in ein Nether-Portal | Teleport wird abgebrochen, Spieler bleibt stehen |
| Mob / Item / Lore geht durchs Portal | Wird abgebrochen (`block-entities`) |
| `/tp` oder anderes Plugin schickt jemanden in den Nether | Wird abgebrochen (`block-plugin-teleports`) |
| Portal bauen / anzünden | Erlaubt |
| Nether verlassen | Erlaubt |

Erkannt wird der Nether über `World.Environment.NETHER`, also auch bei
umbenannten oder mehreren Nether-Welten.

## Konfiguration (`plugins/NoNether/config.yml`)

```yaml
message: "<red>Der Nether ist auf diesem Server deaktiviert."
message-target: ACTION_BAR      # CHAT, ACTION_BAR oder NONE
message-cooldown-seconds: 3
block-entities: true
block-plugin-teleports: true
respect-bypass-permission: true
```

`message` nutzt MiniMessage. Ein leerer String schaltet die Meldung ab.

## Befehle und Rechte

| Befehl | Recht | Wirkung |
|---|---|---|
| `/nonether` bzw. `/nonether status` | `nonether.admin` (op) | Zeigt die aktiven Einstellungen |
| `/nonether reload` | `nonether.admin` (op) | Lädt `config.yml` neu |

| Recht | Standard | Wirkung |
|---|---|---|
| `nonether.bypass` | niemand | Darf den Nether trotzdem betreten |
| `nonether.admin` | op | Darf `/nonether` benutzen |

## Hinweis

Das Plugin lässt die Nether-Welt weiter laufen. Wer den Nether zusätzlich gar
nicht erst laden will, setzt in der `server.properties` `allow-nether=false` —
dann ist dieses Plugin nur noch als Absicherung gegen Plugin-Teleports nötig.
