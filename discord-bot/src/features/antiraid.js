// Anti-Raid: erkennt viele Beitritte in kurzer Zeit und reagiert automatisch.
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { sendLog, logEmbed, Colors } from './logging.js';

// Merkt sich pro Server die Zeitpunkte der letzten Beitritte.
const joinTimestamps = new Map(); // guildId -> number[]
// Verhindert doppelte Raid-Alarme kurz hintereinander.
const raidCooldown = new Map(); // guildId -> timestamp

/** Wird bei jedem neuen Mitglied aufgerufen. */
export async function onMemberJoin(member) {
  const cfg = getGuildConfig(member.guild.id);
  if (!cfg.antiraid.enabled) return;

  // 1) Mindest-Kontoalter pruefen.
  if (cfg.antiraid.minAccountAgeMinutes > 0) {
    const ageMinutes = (Date.now() - member.user.createdTimestamp) / 60000;
    if (ageMinutes < cfg.antiraid.minAccountAgeMinutes) {
      await tryKick(member, `Konto zu neu (< ${cfg.antiraid.minAccountAgeMinutes} Min.)`);
      await alert(member.guild, cfg,
        `🛡️ **${member.user.tag}** abgewiesen – Konto zu neu (${Math.floor(ageMinutes)} Min. alt).`);
      return;
    }
  }

  // 2) Beitritts-Rate im Zeitfenster messen.
  const now = Date.now();
  const windowMs = cfg.antiraid.joinWindowSeconds * 1000;
  const list = (joinTimestamps.get(member.guild.id) || []).filter((t) => now - t < windowMs);
  list.push(now);
  joinTimestamps.set(member.guild.id, list);

  if (list.length >= cfg.antiraid.joinThreshold) {
    await handleRaid(member, cfg, list.length);
  }
}

async function handleRaid(member, cfg, count) {
  const guild = member.guild;
  const last = raidCooldown.get(guild.id) || 0;
  const inCooldown = Date.now() - last < 30000; // max. alle 30s ein Alarm
  raidCooldown.set(guild.id, Date.now());

  if (!inCooldown) {
    await alert(guild, cfg,
      `🚨 **Möglicher Raid erkannt!** ${count} Beitritte in ${cfg.antiraid.joinWindowSeconds}s. Aktion: **${cfg.antiraid.action}**.`);
  }

  switch (cfg.antiraid.action) {
    case 'ban':
      await tryBan(member, 'Anti-Raid: Beitrittswelle');
      break;
    case 'kick':
      await tryKick(member, 'Anti-Raid: Beitrittswelle');
      break;
    case 'lockdown':
      if (!inCooldown) await lockdown(guild, cfg);
      break;
    case 'alert':
    default:
      // Nur benachrichtigen, keine Aktion gegen das Mitglied.
      break;
  }
}

/** Sperrt das Senden von Nachrichten fuer @everyone in allen Textkanaelen. */
async function lockdown(guild, cfg) {
  const everyone = guild.roles.everyone;
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel?.isTextBased?.()) continue;
    await channel.permissionOverwrites
      .edit(everyone, { SendMessages: false })
      .catch(() => {});
  }
  await alert(guild, cfg, '🔒 **Lockdown aktiviert** – @everyone kann vorübergehend nicht schreiben. Mit `/unlock` wieder aufheben.');
}

async function tryKick(member, reason) {
  if (!member.kickable) return;
  await member.kick(reason).catch(() => {});
}

async function tryBan(member, reason) {
  if (!member.bannable) return;
  await member.ban({ reason, deleteMessageSeconds: 0 }).catch(() => {});
}

async function alert(guild, cfg, text) {
  const embed = logEmbed('Anti-Raid', Colors.mod).setDescription(text);
  const channelId = cfg.antiraid.alertChannelId || cfg.logging.channelId;
  if (channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      channel.send({ embeds: [embed] }).catch(() => {});
      return;
    }
  }
  await sendLog(guild, 'modActions', embed);
}

/** Hebt einen Lockdown wieder auf (fuer den /unlock-Befehl). */
export async function liftLockdown(guild) {
  const everyone = guild.roles.everyone;
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel?.isTextBased?.()) continue;
    await channel.permissionOverwrites
      .edit(everyone, { SendMessages: null })
      .catch(() => {});
  }
}

export function _hasManageChannels(guild) {
  return guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels);
}
