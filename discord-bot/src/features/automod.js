// AutoMod: prueft Nachrichten auf Einladungslinks, Spam, Massen-Pings und verbotene Woerter.
import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { sendLog, logEmbed, Colors } from './logging.js';

const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/\S+/i;

// Merkt sich fuer die Spam-Erkennung die letzten Nachrichten-Zeitpunkte je Nutzer.
const recentMessages = new Map(); // `${guildId}:${userId}` -> number[]

/** Prueft eine Nachricht; loescht + warnt bei Verstoessen. Gibt true zurueck, wenn gehandelt wurde. */
export async function checkMessage(message) {
  if (!message.guild || message.author.bot) return false;

  const cfg = getGuildConfig(message.guild.id);
  if (!cfg.automod.enabled) return false;

  // Ausgenommene Rollen (z. B. Moderatoren) ueberspringen.
  const member = message.member;
  if (member && cfg.automod.ignoredRoleIds.some((r) => member.roles.cache.has(r))) return false;
  // Mitglieder mit Nachrichten-verwalten-Recht ausnehmen.
  if (member?.permissions.has('ManageMessages')) return false;

  const content = message.content || '';

  // 1) Einladungslinks
  if (cfg.automod.antiInvite && INVITE_REGEX.test(content)) {
    return await punish(message, cfg, 'Einladungslink nicht erlaubt');
  }

  // 2) Massen-Erwähnungen
  if (cfg.automod.antiMassMention) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions > cfg.automod.maxMentions) {
      return await punish(message, cfg, `Zu viele Erwähnungen (${mentions})`);
    }
  }

  // 3) Verbotene Wörter
  if (cfg.automod.bannedWords.length > 0) {
    const lower = content.toLowerCase();
    if (cfg.automod.bannedWords.some((w) => lower.includes(w.toLowerCase()))) {
      return await punish(message, cfg, 'Verbotenes Wort verwendet');
    }
  }

  // 4) Spam (viele Nachrichten in kurzer Zeit)
  if (cfg.automod.antiSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const windowMs = cfg.automod.spamWindowSeconds * 1000;
    const list = (recentMessages.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    recentMessages.set(key, list);
    if (list.length > cfg.automod.spamMessageCount) {
      recentMessages.set(key, []); // zuruecksetzen, damit nicht mehrfach ausgeloest wird
      return await punish(message, cfg, 'Spam erkannt', true);
    }
  }

  return false;
}

async function punish(message, cfg, reason, timeout = false) {
  await message.delete().catch(() => {});

  // Kurzer Hinweis an den Nutzer (verschwindet nach 5s).
  message.channel
    .send({ content: `<@${message.author.id}>, ${reason}. ⚠️` })
    .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
    .catch(() => {});

  // Bei Spam optional ein kurzer Timeout (60s).
  if (timeout && message.member?.moderatable) {
    await message.member.timeout(60_000, `AutoMod: ${reason}`).catch(() => {});
  }

  const embed = logEmbed('AutoMod', Colors.mod)
    .setDescription(`**Nutzer:** <@${message.author.id}> (${message.author.tag})\n**Grund:** ${reason}\n**Kanal:** <#${message.channel.id}>`)
    .addFields({ name: 'Inhalt', value: (message.content || '—').slice(0, 1000) });
  await sendLog(message.guild, 'modActions', embed);

  return true;
}
