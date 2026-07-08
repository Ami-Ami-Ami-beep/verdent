import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Lässt den Bot eine Nachricht (als Embed) senden.')
    .addStringOption((o) => o.setName('text').setDescription('Was soll gesendet werden?').setRequired(true))
    .addStringOption((o) => o.setName('titel').setDescription('Optionaler Titel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const text = interaction.options.getString('text');
    const title = interaction.options.getString('titel');
    const embed = new EmbedBuilder().setDescription(text).setColor(0x5865f2);
    if (title) embed.setTitle(title);
    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Gesendet.', flags: MessageFlags.Ephemeral });
  }
};
