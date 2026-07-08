import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Setzt den Slowmode (Nachrichten-Verzögerung) im aktuellen Kanal.')
    .addIntegerOption((o) =>
      o.setName('sekunden').setDescription('0–21600 Sekunden (0 = aus)').setRequired(true).setMinValue(0).setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('sekunden');
    await interaction.channel.setRateLimitPerUser(seconds);
    await interaction.reply(seconds === 0 ? '🐇 Slowmode deaktiviert.' : `🐌 Slowmode auf **${seconds}s** gesetzt.`);
  }
};
