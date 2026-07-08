// Verwaltet mehrere Discord-Bots gleichzeitig: startet sie aus der Datenbank,
// erlaubt Hinzufügen (per Token) und Entfernen zur Laufzeit.
import { createBot } from '../bot.js';
import { addBotToken, listBots, removeBotToken } from './database.js';

// botId (DB) → laufender Discord-Client
const clients = new Map();

/** Startet alle in der Datenbank gespeicherten Bots. */
export async function startAllBots() {
  const bots = listBots();
  if (bots.length === 0) {
    console.log('ℹ️  Noch keine Bots hinterlegt – füge einen im Dashboard (oben rechts) hinzu.');
    return;
  }
  for (const b of bots) {
    try {
      await startOne(b.id, b.token);
    } catch (err) {
      console.error(`⚠️  Bot #${b.id} konnte nicht starten: ${err.message}`);
    }
  }
}

async function startOne(id, token) {
  const client = await createBot(token);
  clients.set(id, client);
  return client;
}

/** Fügt einen Bot hinzu, startet ihn und speichert den Token dauerhaft. */
export async function addBot(token, label = '') {
  const clean = String(token || '').trim();
  if (!clean) throw new Error('Kein Token angegeben.');
  const id = addBotToken(clean, label);
  if (clients.has(id)) {
    return { id, tag: clients.get(id).user?.tag || null, online: true }; // schon aktiv
  }
  try {
    const client = await startOne(id, clean);
    return { id, tag: client.user?.tag || null, online: true };
  } catch (err) {
    removeBotToken(id); // Rollback: ungültiger Token wird nicht behalten
    throw err;
  }
}

/** Stoppt und entfernt einen Bot dauerhaft. */
export async function removeBot(id) {
  const client = clients.get(id);
  if (client) {
    try { await client.destroy(); } catch { /* ignore */ }
    clients.delete(id);
  }
  removeBotToken(id);
}

/** Liste aller Bots mit Status (ohne den vollständigen Token preiszugeben). */
export function listRunningBots() {
  return listBots().map((b) => {
    const client = clients.get(b.id);
    return {
      id: b.id,
      label: b.label || '',
      online: !!client?.user,
      tag: client?.user?.tag || null,
      avatar: client?.user?.displayAvatarURL?.({ size: 64 }) || null,
      tokenHint: '••••' + String(b.token).slice(-4)
    };
  });
}

/** Alle Server über alle Bots hinweg (dedupliziert nach Guild-ID). */
export function allGuilds() {
  const map = new Map();
  for (const client of clients.values()) {
    if (!client.guilds) continue;
    for (const g of client.guilds.cache.values()) map.set(g.id, g);
  }
  return [...map.values()];
}

/** Findet einen Server anhand seiner ID über alle Bots. */
export function findGuild(id) {
  for (const client of clients.values()) {
    const g = client.guilds?.cache.get(id);
    if (g) return g;
  }
  return null;
}

export default { startAllBots, addBot, removeBot, listRunningBots, allGuilds, findGuild };
