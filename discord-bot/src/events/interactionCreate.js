import { Events, MessageFlags } from 'discord.js';
import {
  OPEN_BUTTON_ID,
  CLOSE_BUTTON_ID,
  handleOpenTicket,
  handleCloseTicket
} from '../features/tickets.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Button-Klicks (Ticket öffnen/schließen)
    if (interaction.isButton()) {
      try {
        if (interaction.customId === OPEN_BUTTON_ID) return await handleOpenTicket(interaction);
        if (interaction.customId === CLOSE_BUTTON_ID) return await handleCloseTicket(interaction);
      } catch (err) {
        console.error('Fehler bei Button-Interaktion:', err);
      }
      return;
    }

    // Slash-Commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Fehler beim Befehl /${interaction.commandName}:`, err);
      const payload = { content: 'Beim Ausführen ist ein Fehler aufgetreten.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
};
