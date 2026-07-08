// Live-Benachrichtigung: meldet, wenn ein Mitglied zu streamen beginnt (Discord-Status "Streaming").
// Benötigt den privilegierten "Presence Intent" (siehe README / PRESENCE_INTENT).
import { ActivityType } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';

// Merkt sich, wer bereits als "live" gemeldet wurde (kein Doppel-Ping).
const announced = new Set(); // `${guildId}:${userId}`

export async function handlePresence(oldPresence, newPresence) {
  const guild = newPresence?.guild;
  if (!guild) return;
  const cfg = getGuildConfig(guild.id);
  if (!cfg.live.enabled || !cfg.live.channelId) return;

  const streaming = (newPresence.activities || []).find((a) => a.type === ActivityType.Streaming);
  const key = `${guild.id}:${newPresence.userId}`;

  if (!streaming) {
    announced.delete(key); // Stream beendet → wieder meldbar
    return;
  }
  if (announced.has(key)) return;
  announced.add(key);

  const member = newPresence.member;
  if (cfg.live.requiredRoleId && member && !member.roles.cache.has(cfg.live.requiredRoleId)) return;

  const channel = await guild.channels.fetch(cfg.live.channelId).catch(() => null);
  if (!channel) return;

  const text = (cfg.live.message || '🔴 {user} ist jetzt LIVE! {url}')
    .replaceAll('{user}', `<@${newPresence.userId}>`)
    .replaceAll('{url}', streaming.url || '')
    .replaceAll('{game}', streaming.state || streaming.details || streaming.name || '');
  channel.send({ content: text }).catch(() => {});
}
