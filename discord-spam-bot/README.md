# Discord Spam Bot

Ein einfacher Discord-Bot mit einem Slash-Command `/spam`.
Wenn du `/spam` eingibst und ein Wort angibst, schreibt der Bot dieses Wort
mehrmals in den Chat.

## Was der Befehl macht

```
/spam wort:hallo anzahl:5
```

- `wort` – das Wort, das gespammt wird (Pflichtfeld)
- `anzahl` – wie oft (1 bis 10, Standard 5)

> Hinweis: Die Anzahl ist auf **10** begrenzt, damit Discord den Bot nicht
> wegen zu vieler Nachrichten (Rate-Limit) sperrt.

## Einrichtung

### 1. Bot bei Discord erstellen
1. Gehe zu <https://discord.com/developers/applications> und klicke auf
   **New Application**.
2. Öffne links **Bot** und klicke auf **Reset Token**, dann **Copy** –
   das ist dein `DISCORD_TOKEN`.
3. Öffne links **OAuth2 → URL Generator**, wähle die Scopes `bot` und
   `applications.commands` aus, darunter bei den Bot-Berechtigungen
   mindestens **Send Messages**. Öffne die generierte URL, um den Bot auf
   deinen Server einzuladen.

### 2. Projekt lokal starten
```bash
# 1. Abhängigkeiten installieren
pip install -r requirements.txt

# 2. Token setzen (Variante A: .env-Datei)
cp .env.example .env
#   danach .env öffnen und deinen Token eintragen

# 2. Token setzen (Variante B: direkt als Umgebungsvariable)
export DISCORD_TOKEN="dein_token"

# 3. Bot starten
python bot.py
```

Nach dem Start kann es ein paar Minuten dauern, bis der `/spam`-Befehl in
Discord auftaucht (globale Slash-Commands werden von Discord gecacht).

## Sicherheit
- Teile deinen `DISCORD_TOKEN` mit niemandem und committe die `.env` nicht.
- Die `.env` ist bereits in `.gitignore` eingetragen.
