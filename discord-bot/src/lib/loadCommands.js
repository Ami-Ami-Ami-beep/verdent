// Lädt alle Slash-Command-Module aus src/commands.
// Ein Modul kann einen einzelnen Command (default = { data, execute })
// oder mehrere Commands (default = [ {data,execute}, ... ]) exportieren.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = join(__dirname, '..', 'commands');

export async function loadCommands() {
  const commands = [];
  const files = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const mod = await import(pathToFileURL(join(COMMANDS_DIR, file)).href);
    const exported = mod.default;
    const list = Array.isArray(exported) ? exported : [exported];
    for (const cmd of list) {
      if (cmd?.data && typeof cmd.execute === 'function') {
        commands.push(cmd);
      } else {
        console.warn(`⚠️  ${file} exportiert keinen gültigen Command (data/execute fehlt).`);
      }
    }
  }
  return commands;
}
