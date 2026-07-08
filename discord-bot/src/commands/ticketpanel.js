import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { buildTicketPanel } from '../features/tickets.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Postet das Ticket-Panel mit Button in diesem Kanal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const cfg = getGuildConfig(interaction.guildId);
    if (!cfg.tickets.enabled) {
      return interaction.reply({
        content: 'Das Ticket-System ist deaktiviert. Aktiviere es zuerst im Dashboard.',
        flags: MessageFlags.Ephemeral
      });
    }
    if (!cfg.tickets.types || cfg.tickets.types.length === 0) {
      return interaction.reply({
        content: 'Es ist noch keine Ticket-Art konfiguriert. Füge im Dashboard mindestens eine hinzu.',
        flags: MessageFlags.Ephemeral
      });
    }
    await interaction.channel.send(buildTicketPanel(cfg));
    await interaction.reply({ content: '✅ Ticket-Panel wurde gepostet.', flags: MessageFlags.Ephemeral });
  }
};
