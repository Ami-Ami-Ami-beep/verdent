import { Events } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';
import { formatMemberMessage } from '../lib/format.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const cfg = getGuildConfig(member.guild.id);

    // Abschiedsnachricht
    if (cfg.welcome.leaveEnabled && cfg.welcome.channelId) {
      const channel = await member.guild.channels.fetch(cfg.welcome.channelId).catch(() => null);
      if (channel) {
        channel.send({ content: formatMemberMessage(cfg.welcome.leaveMessage, member) }).catch(() => {});
      }
    }

    const embed = logEmbed('Mitglied verlassen', Colors.leave)
      .setDescription(`<@${member.id}> (${member.user.tag})`)
      .setThumbnail(member.user.displayAvatarURL());
    await sendLog(member.guild, 'memberLeave', embed);
  }
};
