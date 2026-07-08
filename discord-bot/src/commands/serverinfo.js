import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Zeigt Infos über den Server.'),

  async execute(interaction) {
    const g = interaction.guild;
    const owner = await g.fetchOwner().catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle(g.name)
      .setThumbnail(g.iconURL({ size: 256 }))
      .setColor(0x5865f2)
      .addFields(
        { name: 'Mitglieder', value: String(g.memberCount), inline: true },
        { name: 'Besitzer', value: owner ? `<@${owner.id}>` : '—', inline: true },
        { name: 'Rollen', value: String(g.roles.cache.size), inline: true },
        { name: 'Kanäle', value: String(g.channels.cache.size), inline: true },
        { name: 'Boosts', value: String(g.premiumSubscriptionCount ?? 0), inline: true },
        { name: 'Erstellt', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true }
      )
      .setFooter({ text: `Server-ID: ${g.id}` });
    await interaction.reply({ embeds: [embed] });
  }
};
