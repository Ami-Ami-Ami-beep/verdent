import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Löscht mehrere Nachrichten im aktuellen Kanal.')
    .addIntegerOption((o) =>
      o.setName('anzahl').setDescription('Wie viele Nachrichten (1–100)?').setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('anzahl');
    // Discord kann nur Nachrichten löschen, die jünger als 14 Tage sind.
    const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);

    if (!deleted) {
      return interaction.reply({ content: 'Konnte die Nachrichten nicht löschen (evtl. älter als 14 Tage).', flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: `🧹 **${deleted.size}** Nachricht(en) gelöscht.`, flags: MessageFlags.Ephemeral });
  }
};
