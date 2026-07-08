// Temp-Voice (Join-to-Create): Wer den "Hub"-Sprachkanal betritt, bekommt einen
// eigenen temporären Kanal. Ist der leer, wird er automatisch gelöscht.
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';

// Merkt sich die selbst erstellten temporären Kanäle (nur im Speicher).
const tempChannels = new Set();

export async function handleVoice(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;
  const cfg = getGuildConfig(guild.id);

  // Betritt jemand den Hub-Kanal → eigenen Kanal erstellen.
  if (cfg.tempvoice.enabled && newState.channelId && newState.channelId === cfg.tempvoice.hubChannelId) {
    const member = newState.member;
    try {
      const channel = await guild.channels.create({
        name: `🔊 ${member.displayName}`,
        type: ChannelType.GuildVoice,
        parent: cfg.tempvoice.categoryId || newState.channel?.parentId || null,
        permissionOverwrites: [
          { id: member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] }
        ]
      });
      tempChannels.add(channel.id);
      await member.voice.setChannel(channel).catch(() => {});
    } catch (err) {
      console.error('Temp-Voice-Fehler:', err);
    }
  }

  // Verlässt jemand einen temporären Kanal und der ist leer → löschen.
  if (oldState.channelId && tempChannels.has(oldState.channelId)) {
    const channel = oldState.channel;
    if (channel && channel.members.size === 0) {
      tempChannels.delete(channel.id);
      channel.delete().catch(() => {});
    }
  }
}
