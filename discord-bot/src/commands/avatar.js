import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Zeigt den Avatar eines Mitglieds in groß.')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Avatar?')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = new EmbedBuilder()
      .setTitle(`Avatar von ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 512 }))
      .setColor(0x5865f2);
    await interaction.reply({ embeds: [embed] });
  }
};
