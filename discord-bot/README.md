# 🤖 Verdent Discord Bot

Ein Discord-Bot mit **Ticket-System**, **Anti-Raid**, **AutoMod**, **Moderation** und **Logging** –
inklusive einer **einfachen Konfigurations-Website** (Dashboard). Alles wird in einer
**SQLite-Datenbank** gespeichert (keine JSON-Dateien, kein separater Datenbank-Server nötig).

## ✨ Funktionen

| Feature | Beschreibung |
|---|---|
| 🎫 **Tickets** | **Mehrere Ticket-Arten** (eigener Button, Kategorie, Team-Rollen, Begrüßung), private Kanäle, Transkript beim Schließen |
| 🛡️ **Anti-Raid** | Erkennt Beitrittswellen, Aktion wählbar (Kick/Ban/Lockdown/Alarm), Mindest-Kontoalter |
| 🔨 **AutoMod** | Einladungslinks, Spam, Massen-Erwähnungen, verbotene Wörter |
| 👋 **Willkommen** | Begrüßungs- und Abschiedsnachrichten mit Platzhaltern |
| 📋 **Logging** | Gelöschte/bearbeitete Nachrichten, Beitritte/Austritte, Mod-Aktionen |
| 📝 **Bewerbungen** | **Mehrere Bewerbungs-Arten** (eigene Fragen, Review-Kanal, Rolle) → Formular → Annehmen/Ablehnen + DM |
| 🎭 **Selbstrollen** | Button-Panel, mit dem Mitglieder sich Rollen selbst geben/nehmen |
| ⭐ **Autorole** | Automatische Rolle beim Serverbeitritt |
| 📈 **Level-System** | XP fürs Schreiben, `/rank`, `/leaderboard`, Level-up-Nachrichten |
| 💡 **Vorschläge** | `/suggest` postet in einen Kanal mit 👍/👎-Abstimmung |
| ⚙️ **Moderation** | `/ban` `/kick` `/timeout` `/warn` `/warnings` `/clearwarnings` `/purge` `/lock` `/unlock` |
| 🛠️ **Utility** | `/userinfo` `/serverinfo` `/avatar` `/ping` `/poll` `/slowmode` `/say` `/giveaway` |
| 🌐 **Dashboard** | Web-Oberfläche zum Ein-/Ausschalten und Konfigurieren aller Features |

## 📦 Voraussetzungen

- [Node.js](https://nodejs.org/) **18 oder neuer**
- Ein Discord-Bot im [Developer Portal](https://discord.com/developers/applications)

## 🚀 Einrichtung

### 1. Bot im Discord Developer Portal erstellen
1. Auf [discord.com/developers/applications](https://discord.com/developers/applications) eine **New Application** erstellen.
2. Links auf **Bot** → **Reset Token** → Token kopieren.
3. Unter **Bot** die **Privileged Gateway Intents** aktivieren:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
4. Unter **OAuth2 → URL Generator**: Scopes `bot` + `applications.commands`,
   Bot-Rechte z. B. `Administrator` (oder gezielt: Kick, Ban, Manage Channels,
   Manage Messages, Moderate Members). Mit der erzeugten URL den Bot einladen.

### 2. Projekt installieren
```bash
cd discord-bot
npm install
cp .env.example .env
```

### 3. `.env` ausfüllen
```env
DISCORD_TOKEN=dein-bot-token
CLIENT_ID=deine-application-id
GUILD_ID=deine-testserver-id      # optional, für sofortige Slash-Commands
WEB_PORT=3000
DASHBOARD_PASSWORD=eigenes-passwort
SESSION_SECRET=langer-zufaelliger-string
```

### 4. Slash-Commands registrieren
```bash
npm run deploy
```
> Mit gesetzter `GUILD_ID` erscheinen sie sofort. Ohne kann es (global) bis zu 1 Stunde dauern.

### 5. Bot + Dashboard starten
```bash
npm start
```
- Der Bot meldet sich bei Discord an.
- Das Dashboard läuft auf **http://localhost:3000** → mit dem `DASHBOARD_PASSWORD` anmelden.

## 🖥️ Dashboard benutzen

1. Im Browser das Dashboard öffnen und anmelden.
2. Oben rechts den **Server auswählen**.
3. Für jedes Feature den **Schalter** umlegen und die Felder ausfüllen
   (Kanäle und Rollen erscheinen automatisch als Auswahl).
4. Unten auf **Speichern** klicken – fertig, Änderungen greifen sofort.

## 🎫 Tickets aktivieren
1. Im Dashboard das Ticket-System einschalten, Kategorie + Team-Rolle + Log-Kanal wählen, speichern.
2. Auf dem Server `/ticketpanel` in dem Kanal ausführen, in dem der Button erscheinen soll.

## ☁️ Hosting auf einem Panel (Pelican / Pterodactyl)

Der Bot läuft direkt auf Node.js-Panels. So geht's:

1. **Alle Projektdateien** in den Server-Ordner (`/home/container`) hochladen –
   also so, dass `index.js`, `package.json` und der `src/`-Ordner direkt im
   Hauptverzeichnis liegen.
2. **Startdatei / JS-File** im Panel auf `index.js` setzen (Standard). Es gibt
   im Projekt-Root eine `index.js`, die den Bot aus `src/` startet.
3. **Konfiguration anlegen:** Am einfachsten im File Manager eine normale Datei
   **`config.txt`** erstellen (keine versteckte Datei nötig!) und ausfüllen:
   ```
   DISCORD_TOKEN=dein-token
   CLIENT_ID=deine-application-id
   GUILD_ID=deine-server-id
   ```
   Der Bot liest `config.txt` (oder `.env`) automatisch beim Start.
   Eine fertige Vorlage liegt als `config.example.txt` bei.
4. **Starten.** Beim Start installiert das Panel automatisch die Abhängigkeiten
   (`npm install`) und der Bot **registriert die Slash-Commands selbst**
   (`AUTO_DEPLOY=1`). Ein separates `npm run deploy` ist nicht nötig.

> Für das Dashboard einen Port im Panel freigeben und `WEB_PORT` auf dessen
> Wert setzen (oft die vom Panel zugewiesene Server-Port-Variable).

## 🗂️ Projektstruktur
```
discord-bot/
├── src/
│   ├── index.js            # startet Bot + Dashboard
│   ├── bot.js              # Discord-Client, lädt Commands & Events
│   ├── deploy-commands.js  # registriert die Slash-Commands
│   ├── commands/           # /ban, /kick, /warn, /ticketpanel, ...
│   ├── events/             # Beitritte, Nachrichten, Interaktionen, ...
│   ├── features/           # tickets, antiraid, automod, logging
│   ├── lib/                # database.js (SQLite), Loader, Helfer
│   └── web/                # Express-Dashboard (server.js + public/)
└── data/                   # bot.sqlite (wird automatisch angelegt)
```

## ❓ Häufige Fragen

**Die Slash-Commands erscheinen nicht.**
`npm run deploy` ausführen. Ohne `GUILD_ID` dauert die globale Registrierung bis zu 1 Stunde.

**Der Bot kann keine Tickets erstellen.**
Der Bot braucht das Recht **Kanäle verwalten** und eine gültige Kategorie-ID.

**Anti-Raid / AutoMod reagiert nicht.**
Prüfe, ob im Developer Portal **Server Members Intent** und **Message Content Intent** aktiv sind.

## 📄 Lizenz
MIT
