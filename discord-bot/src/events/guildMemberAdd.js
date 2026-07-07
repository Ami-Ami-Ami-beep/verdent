import { Events } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { onMemberJoin } from '../features/antiraid.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';
import { formatMemberMessage } from '../lib/format.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // Anti-Raid zuerst – kann das Mitglied ggf. direkt entfernen.
    await onMemberJoin(member);

    const cfg = getGuildConfig(member.guild.id);

    // Willkommensnachricht
    if (cfg.welcome.enabled && cfg.welcome.channelId) {
      const channel = await member.guild.channels.fetch(cfg.welcome.channelId).catch(() => null);
      if (channel) {
        channel.send({ content: formatMemberMessage(cfg.welcome.message, member) }).catch(() => {});
      }
    }

    // Logging
    const embed = logEmbed('Mitglied beigetreten', Colors.join)
      .setDescription(`<@${member.id}> (${member.user.tag})`)
      .addFields(
        { name: 'Konto erstellt', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Mitglieder', value: String(member.guild.memberCount), inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL());
    await sendLog(member.guild, 'memberJoin', embed);
  }
};
