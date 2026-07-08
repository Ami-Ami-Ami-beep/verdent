import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('membercount').setDescription('Zeigt die Mitgliederzahl des Servers.'),

  async execute(interaction) {
    const g = interaction.guild;
    const members = await g.members.fetch().catch(() => null);
    let humans = null;
    let bots = null;
    if (members) {
      bots = members.filter((m) => m.user.bot).size;
      humans = g.memberCount - bots;
    }
    const embed = new EmbedBuilder()
      .setTitle(`👥 Mitglieder von ${g.name}`)
      .setColor(0x5865f2)
      .setDescription(
        `**Gesamt:** ${g.memberCount}` +
        (humans !== null ? `\n**Menschen:** ${humans}\n**Bots:** ${bots}` : '')
      );
    await interaction.reply({ embeds: [embed] });
  }
};
