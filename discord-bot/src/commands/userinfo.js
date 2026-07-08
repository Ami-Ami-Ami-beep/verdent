import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Zeigt Infos über ein Mitglied.')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Infos?')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const roles = member
      ? member.roles.cache.filter((r) => r.id !== interaction.guild.id).map((r) => `<@&${r.id}>`).join(' ') || 'keine'
      : '—';

    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setColor(member?.displayHexColor || 0x5865f2)
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot?', value: user.bot ? 'Ja' : 'Nein', inline: true },
        { name: 'Konto erstellt', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: false }
      );
    if (member?.joinedTimestamp) {
      embed.addFields({ name: 'Beigetreten', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: false });
    }
    embed.addFields({ name: 'Rollen', value: roles.slice(0, 1024) });
    await interaction.reply({ embeds: [embed] });
  }
};
