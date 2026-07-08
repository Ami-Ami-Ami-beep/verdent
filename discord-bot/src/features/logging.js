// Zentrale Hilfsfunktion, um Log-Embeds in den konfigurierten Log-Kanal zu schicken.
import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';

/**
 * Schickt ein Log-Embed, sofern Logging aktiv ist und der jeweilige Typ eingeschaltet ist.
 * @param {import('discord.js').Guild} guild
 * @param {string} type  z. B. 'messageDelete', 'memberJoin', 'modActions'
 * @param {EmbedBuilder} embed
 */
export async function sendLog(guild, type, embed) {
  if (!guild) return;
  const cfg = getGuildConfig(guild.id);
  if (!cfg.logging.enabled || !cfg.logging.channelId) return;
  if (type && cfg.logging[type] === false) return;

  const channel = await guild.channels.fetch(cfg.logging.channelId).catch(() => null);
  if (!channel) return;
  channel.send({ embeds: [embed] }).catch(() => {});
}

export function logEmbed(title, color) {
  return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
}

// Farbpalette fuer die verschiedenen Log-Typen.
export const Colors = {
  delete: 0xed4245,
  edit: 0xfee75c,
  join: 0x57f287,
  leave: 0xeb459e,
  mod: 0x5865f2
};
