import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Erinnert dich nach einer bestimmten Zeit.')
    .addIntegerOption((o) => o.setName('minuten').setDescription('In wie vielen Minuten?').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addStringOption((o) => o.setName('text').setDescription('Woran soll ich dich erinnern?').setRequired(true)),

  async execute(interaction) {
    const minutes = interaction.options.getInteger('minuten');
    const text = interaction.options.getString('text');
    await interaction.reply({ content: `⏰ Alles klar! Ich erinnere dich in **${minutes} Min.** an: ${text}`, flags: MessageFlags.Ephemeral });

    // Hinweis: läuft über einen Timer – überlebt keinen Bot-Neustart.
    setTimeout(() => {
      interaction.user.send(`⏰ Erinnerung: ${text}`).catch(() => {
        interaction.channel?.send({ content: `⏰ <@${interaction.user.id}> Erinnerung: ${text}` }).catch(() => {});
      });
    }, minutes * 60_000);
  }
};
