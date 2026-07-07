// Erstellt den Discord-Client, lädt Commands und Events und meldet sich an.
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCommands } from './lib/loadCommands.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createBot(token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,     // Beitritte/Austritte (Anti-Raid, Welcome)
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,   // Nachrichteninhalt (AutoMod)
      GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
  });

  // Commands laden
  client.commands = new Collection();
  for (const cmd of await loadCommands()) {
    client.commands.set(cmd.data.name, cmd);
  }
  console.log(`   ${client.commands.size} Command(s) geladen.`);

  // Events laden
  const eventsDir = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsDir).filter((f) => f.endsWith('.js'));
  for (const file of eventFiles) {
    const { default: event } = await import(pathToFileURL(join(eventsDir, file)).href);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
  console.log(`   ${eventFiles.length} Event(s) geladen.`);

  await client.login(token);
  return client;
}
