// Startet Bot und Konfigurations-Website gemeinsam.
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBot } from './bot.js';
import { startWeb } from './web/server.js';

// .env immer aus dem Projekt-Ordner laden – unabhängig vom Arbeitsverzeichnis.
// (src/index.js liegt in src/, der Projekt-Ordner ist eine Ebene höher.)
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(rootDir, '.env');
config({ path: envPath });

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN fehlt.');
  console.error(`   Gesuchte .env-Datei: ${envPath}`);
  console.error(`   .env vorhanden: ${existsSync(envPath) ? 'JA (aber DISCORD_TOKEN fehlt darin)' : 'NEIN – bitte im File Manager anlegen'}`);
  console.error('   Beispiel-Inhalt:  DISCORD_TOKEN=dein-token');
  process.exit(1);
}

console.log('🚀 Starte Verdent Discord Bot …');

const client = await createBot(process.env.DISCORD_TOKEN);
startWeb(client);

// Sauberes Beenden
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n👋 Fahre herunter …');
    client.destroy();
    process.exit(0);
  });
}
