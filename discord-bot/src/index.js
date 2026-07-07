// Startet Bot und Konfigurations-Website gemeinsam.
import 'dotenv/config';
import { createBot } from './bot.js';
import { startWeb } from './web/server.js';

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN fehlt. Kopiere .env.example nach .env und trage deinen Bot-Token ein.');
  process.exit(1);
}

console.log('🚀 Starte Verdent Discord Bot …');

const client = await createBot(DISCORD_TOKEN);
startWeb(client);

// Sauberes Beenden
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n👋 Fahre herunter …');
    client.destroy();
    process.exit(0);
  });
}
