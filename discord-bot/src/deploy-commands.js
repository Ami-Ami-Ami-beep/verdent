// Registriert die Slash-Commands bei Discord.
// GUILD_ID gesetzt  → sofort auf dem Testserver.
// GUILD_ID leer     → global (kann bis zu 1 Stunde dauern).
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadCommands } from './lib/loadCommands.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN und CLIENT_ID müssen in der .env gesetzt sein.');
  process.exit(1);
}

const commands = (await loadCommands()).map((c) => c.data.toJSON());
const rest = new REST().setToken(DISCORD_TOKEN);

try {
  console.log(`Registriere ${commands.length} Slash-Command(s) …`);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`✅ Fertig (${GUILD_ID ? 'Server ' + GUILD_ID : 'global'}).`);
} catch (err) {
  console.error('❌ Registrierung fehlgeschlagen:', err);
  process.exit(1);
}
