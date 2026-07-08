// Startet das Dashboard und alle hinterlegten Bots.
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWeb } from './web/server.js';
import * as manager from './lib/botManager.js';
import { addBotToken } from './lib/database.js';

// Konfiguration laden – aus dem Projekt-Ordner, unabhängig vom Arbeitsverzeichnis.
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['.env', 'config.txt', 'config.env']) {
  const path = join(rootDir, name);
  if (existsSync(path)) config({ path });
}

console.log('🚀 Starte Amu Bot …');

// Falls ein Token in der config.txt steht, als ersten Bot übernehmen.
if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN.trim()) {
  addBotToken(process.env.DISCORD_TOKEN.trim());
}

// Dashboard ZUERST starten – so kann man auch ohne laufende Bots
// oben rechts einen Bot per Token hinzufügen.
startWeb(manager);

// Danach alle gespeicherten Bots starten.
await manager.startAllBots();

// Sauberes Beenden
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n👋 Fahre herunter …');
    process.exit(0);
  });
}
