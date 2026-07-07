// Registriert die Slash-Commands bei Discord (per REST).
// Wird sowohl vom separaten Script (deploy-commands.js) als auch
// automatisch beim Bot-Start verwendet.
import { REST, Routes } from 'discord.js';

export async function deployCommands(commands, { token, clientId, guildId }) {
  const body = commands.map((c) => c.data.toJSON());
  const rest = new REST().setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body });
  return body.length;
}
