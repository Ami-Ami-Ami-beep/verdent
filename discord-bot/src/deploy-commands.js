// Registriert die Slash-Commands bei Discord (manuell aufrufbar via `npm run deploy`).
// GUILD_ID gesetzt  → sofort auf dem Testserver.
// GUILD_ID leer     → global (kann bis zu 1 Stunde dauern).
import 'dotenv/config';
import { loadCommands } from './lib/loadCommands.js';
import { deployCommands } from './lib/deploy.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN und CLIENT_ID müssen in der .env gesetzt sein.');
  process.exit(1);
}

try {
  const commands = await loadCommands();
  console.log(`Registriere ${commands.length} Slash-Command(s) …`);
  await deployCommands(commands, { token: DISCORD_TOKEN, clientId: CLIENT_ID, guildId: GUILD_ID });
  console.log(`✅ Fertig (${GUILD_ID ? 'Server ' + GUILD_ID : 'global'}).`);
} catch (err) {
  console.error('❌ Registrierung fehlgeschlagen:', err);
  process.exit(1);
}
