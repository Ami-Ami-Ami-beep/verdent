// Level-System: vergibt XP fürs Schreiben und meldet Level-Aufstiege.
import { getGuildConfig, addXp } from '../lib/database.js';

// Cooldown pro Nutzer, damit Spammen nicht mehr XP bringt.
const cooldowns = new Map(); // `${guildId}:${userId}` -> timestamp

export async function handleMessageXp(message) {
  if (!message.guild || message.author.bot) return;
  const cfg = getGuildConfig(message.guild.id);
  if (!cfg.levels.enabled) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (now - (cooldowns.get(key) || 0) < cfg.levels.cooldownSeconds * 1000) return;
  cooldowns.set(key, now);

  const res = addXp(message.guild.id, message.author.id, cfg.levels.xpPerMessage);
  if (!res.leveledUp || !cfg.levels.announce) return;

  const text = `🎉 <@${message.author.id}> ist jetzt **Level ${res.level}**!`;
  let channel = message.channel;
  if (cfg.levels.announceChannelId) {
    const c = await message.guild.channels.fetch(cfg.levels.announceChannelId).catch(() => null);
    if (c) channel = c;
  }
  channel.send({ content: text }).catch(() => {});
}
