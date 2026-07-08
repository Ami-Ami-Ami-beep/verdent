import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Erstellt eine Ja/Nein-Umfrage.')
    .addStringOption((o) => o.setName('frage').setDescription('Die Frage').setRequired(true)),

  async execute(interaction) {
    const question = interaction.options.getString('frage');
    const embed = new EmbedBuilder()
      .setTitle('📊 Umfrage')
      .setDescription(question)
      .setColor(0x5865f2)
      .setFooter({ text: `Umfrage von ${interaction.user.tag}` });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react('👍').catch(() => {});
    await msg.react('👎').catch(() => {});
  }
};
