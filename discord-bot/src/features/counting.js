// Zählkanal: In einem Kanal zählen Mitglieder abwechselnd hoch (1, 2, 3 …).
// Falsche Zahl oder zweimal dieselbe Person → Kette bricht, zurück zu 1.
import { getGuildConfig, getCounting, setCounting } from '../lib/database.js';

/** Gibt true zurück, wenn die Nachricht als Zähl-Nachricht behandelt wurde. */
export async function handleCounting(message) {
  if (!message.guild || message.author.bot) return false;
  const cfg = getGuildConfig(message.guild.id);
  if (!cfg.counting.enabled || cfg.counting.channelId !== message.channel.id) return false;

  const text = (message.content || '').trim();
  const num = Number.parseInt(text, 10);

  // Keine reine Zahl → löschen (der Kanal ist nur zum Zählen da).
  if (Number.isNaN(num) || String(num) !== text) {
    await message.delete().catch(() => {});
    return true;
  }

  const state = getCounting(message.guild.id);
  const expected = (state.current || 0) + 1;

  if (num !== expected || message.author.id === state.lastUser) {
    await message.react('❌').catch(() => {});
    setCounting(message.guild.id, 0, '');
    const reason = message.author.id === state.lastUser ? 'zweimal hintereinander' : `falsche Zahl (erwartet: **${expected}**)`;
    message.channel.send(`❌ ${message.author} hat die Kette gebrochen (${reason}). Weiter geht's bei **1**.`).catch(() => {});
    return true;
  }

  setCounting(message.guild.id, num, message.author.id);
  await message.react('✅').catch(() => {});
  return true;
}
