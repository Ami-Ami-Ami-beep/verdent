# BotPanel

Plattform zum Erstellen, Konfigurieren und Betreiben von Discord-Bots auf dem eigenen VPS.
Bedienung über eine **Website** und eine **Windows-App**. Beide nutzen dieselbe Oberfläche und dasselbe Backend.

```
Website / Windows-App  ──HTTPS──▶  API (Fastify)  ──▶  PostgreSQL
                                      │  Redis Pub/Sub
                                      ▼
                                 bot-runner (discord.js)  ──▶  Discord
```

| Ordner | Inhalt |
| --- | --- |
| `apps/api` | REST-API, Discord-Login (OAuth2), liefert im Betrieb auch die Website aus |
| `apps/web` | Dashboard (React + Vite + Tailwind) |
| `apps/desktop` | Windows-App (Electron), lädt das Dashboard von deinem Server |
| `apps/bot-runner` | Startet und verwaltet alle Bots, Module in `src/modules/` |
| `packages/shared` | Konfigurations-Schemas (zod), Typen, Events, Verschlüsselung |
| `packages/db` | Prisma-Schema und Migrationen |

## Stand

| Funktion | Status |
| --- | --- |
| Login mit Discord, Bots hinzufügen (Token wird verschlüsselt), Starten/Stoppen, Einladungslink | ✅ |
| Partner-Bot festlegen (Bot A ↔ Bot B) | ✅ Einstellung, Schutzlogik folgt in Phase 2 |
| Modul **Willkommen/Abschied** inkl. Autorollen | ✅ |
| Module Tickets, Bewerbungen, Dropdown-Rollen, Spam-Schutz, Sicherheit/Anti-Nuke | Schemas fertig, Logik und Formulare folgen in Phase 2 |
| Eigener Bot-Code (JavaScript und Python) in abgeschotteten Docker-Containern | Phase 3 |

### Was Discord technisch nicht erlaubt
- **Ein Bot kann einen anderen Bot nicht selbst wieder einladen.** Bots kommen nur über einen Einladungslink auf einen Server, den ein Mensch mit „Server verwalten“ bestätigt. Wird Bot A gekickt, bestraft Bot B den Täter sofort und schickt dem Owner den Einladungslink.
- **Der Server-Owner kann immer alles.** Schutz vor anderen Admins gibt es über die Rollen-Hierarchie (Bot-Rolle ganz oben) und das Audit-Log.

## 1. Discord-Anwendungen anlegen

Im [Developer Portal](https://discord.com/developers/applications):

1. **Login-App (einmalig):** eine Application für den Website-Login.
   - Unter *OAuth2*: `Client ID` und `Client Secret` kopieren → `.env`
   - Unter *OAuth2 → Redirects*: `https://DEINE-DOMAIN/api/auth/callback` eintragen (lokal: `http://localhost:5173/api/auth/callback`)
2. **Pro Bot:** eine eigene Application.
   - Unter *Bot*: **Server Members Intent** und **Message Content Intent** aktivieren
   - *Reset Token* → Token im Dashboard unter „Bot hinzufügen“ einfügen

## 2. Lokal entwickeln

Voraussetzungen: Node.js 22, pnpm (`corepack enable`), Docker.

```bash
cd botpanel
cp .env.example .env        # Werte eintragen (siehe Kommentare in der Datei)
docker compose up -d        # startet nur PostgreSQL + Redis
pnpm install
pnpm build                  # einmal bauen (shared/db werden von den Apps genutzt)
pnpm db:deploy              # Datenbank-Tabellen anlegen

# je in eigenem Terminal:
pnpm dev:api                # http://localhost:3000
pnpm dev:bot
pnpm dev:web                # http://localhost:5173  ← im Browser öffnen
```

Tests: `pnpm test`, Typprüfung: `pnpm typecheck`.

## 3. Auf dem VPS betreiben

```bash
git clone <repo> && cd <repo>/botpanel
cp .env.example .env
# In .env setzen:
#   PUBLIC_URL=https://panel.deine-domain.de
#   DISCORD_REDIRECT_URI=https://panel.deine-domain.de/api/auth/callback
#   SESSION_SECRET / TOKEN_ENCRYPTION_KEY / POSTGRES_PASSWORD (jeweils: openssl rand -hex 32)
docker compose --profile app up -d --build
```

Die API lauscht nur auf `127.0.0.1:3000`. Davor gehört ein Reverse-Proxy mit HTTPS, z. B. [Caddy](https://caddyserver.com) mit dieser `Caddyfile`:

```
panel.deine-domain.de {
    reverse_proxy 127.0.0.1:3000
}
```

> ⚠️ `TOKEN_ENCRYPTION_KEY` sichern! Geht er verloren, sind alle gespeicherten Bot-Tokens unbrauchbar.

Updates: `git pull && docker compose --profile app up -d --build`. Migrationen laufen beim Start automatisch.

## 4. Windows-App

- **Installer bauen:** GitHub → *Actions* → „BotPanel Windows-App“ → *Run workflow*. Danach steht `BotPanel-Setup` als Download bereit.
  Lokal unter Windows geht es auch mit `pnpm --filter @botpanel/desktop dist:win`.
- Beim ersten Start fragt die App nach der Server-Adresse (z. B. `panel.deine-domain.de`). Ändern kannst du sie später im Menü *BotPanel → Server-Adresse ändern*.
- Die App zeigt das Dashboard deines Servers. Neue Funktionen der Website sind deshalb automatisch auch in der App da, ohne Update.

## Sicherheit
- Bot-Tokens und Discord-Zugangstokens sind in der Datenbank mit AES-256-GCM verschlüsselt und werden nie an die Oberfläche geschickt.
- In der Datenbank liegt nur ein Hash der Sitzungs-IDs.
- Nutzer können nur Server konfigurieren, auf denen sie selbst „Server verwalten“ haben **und** der Bot ist.
- Cookies sind `HttpOnly` + `SameSite=Lax`, die API nimmt nur JSON an (Schutz gegen CSRF). Ratenbegrenzung: 120 Anfragen pro Minute und IP.

## Ein neues Modul hinzufügen
1. Schema in `packages/shared/src/modules.ts` (ist für alle Module schon vorhanden)
2. Logik als `apps/bot-runner/src/modules/<name>.ts` mit `register(ctx)` und in `modules/index.ts` eintragen (Vorlage: `welcome.ts`)
3. Formular als `apps/web/src/modules/<Name>Form.tsx` und in `GuildPage.tsx` einbinden (Vorlage: `WelcomeForm.tsx`)
