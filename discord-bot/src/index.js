// Startet Bot und Konfigurations-Website gemeinsam.
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBot } from './bot.js';
import { startWeb } from './web/server.js';

// Konfiguration laden – aus dem Projekt-Ordner, unabhängig vom Arbeitsverzeichnis.
// Es werden mehrere Dateinamen unterstützt. `config.txt` ist am einfachsten,
// weil es keine versteckte Datei ist (praktisch für Hosting-Panels).
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILES = ['.env', 'config.txt', 'config.env'];

for (const name of CONFIG_FILES) {
  const path = join(rootDir, name);
  if (existsSync(path)) config({ path }); // vorhandene Werte werden nicht überschrieben
}

if (!process.env.DISCORD_TOKEN) {
  const found = CONFIG_FILES.filter((n) => existsSync(join(rootDir, n)));
  console.error('❌ DISCORD_TOKEN fehlt.');
  console.error(`   Ordner: ${rootDir}`);
  if (found.length === 0) {
    console.error('   Keine Konfigurationsdatei gefunden.');
    console.error('   → Lege eine Datei namens  config.txt  an (normale, sichtbare Datei) mit dem Inhalt:');
    console.error('        DISCORD_TOKEN=dein-token');
    console.error('        CLIENT_ID=deine-application-id');
  } else {
    console.error(`   Gefundene Datei(en): ${found.join(', ')} – aber darin fehlt die Zeile DISCORD_TOKEN=...`);
  }
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
