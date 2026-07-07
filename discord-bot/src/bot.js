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

  try {
    await client.login(token);
  } catch (err) {
    if (err?.code === 'TokenInvalid') printTokenDiagnostics(token);
    throw err;
  }
  return client;
}

// Gibt Hinweise zum Token aus – OHNE den Token selbst zu zeigen.
function printTokenDiagnostics(token) {
  const raw = token ?? '';
  const trimmed = raw.trim();
  const parts = trimmed.split('.');
  console.error('\n🔎 Token-Diagnose (der Token selbst wird nicht angezeigt):');
  console.error(`   Länge: ${trimmed.length} Zeichen (ein Bot-Token hat meist ~59–75)`);
  console.error(`   Punkte-Teile: ${parts.length} (ein gültiger Bot-Token hat genau 3)`);
  if (raw !== trimmed) console.error('   ⚠️  Enthält Leerzeichen/Zeilenumbruch am Anfang/Ende – bitte entfernen.');
  if (/\s/.test(trimmed)) console.error('   ⚠️  Enthält ein Leerzeichen mitten drin – der Token wurde evtl. unvollständig kopiert.');
  if (/^["'].*["']$/.test(trimmed)) console.error('   ⚠️  Steht in Anführungszeichen – bitte die " oder \' entfernen.');
  if (/^\d+$/.test(trimmed)) console.error('   ⚠️  Besteht nur aus Zahlen – das ist die APPLICATION ID (CLIENT_ID), NICHT der Bot-Token!');
  if (parts.length === 3 && !/\s/.test(trimmed) && raw === trimmed) {
    console.error('   → Struktur sieht gültig aus. Wahrscheinlich wurde der Token zurückgesetzt.');
    console.error('     Hol im Developer Portal unter Bot → "Reset Token" einen NEUEN und trag ihn ein.');
  }
  console.error('');
}
