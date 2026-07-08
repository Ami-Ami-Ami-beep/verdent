import { Events, MessageFlags } from 'discord.js';
import {
  OPEN_BUTTON_PREFIX,
  CLOSE_BUTTON_ID,
  handleOpenTicket,
  handleCloseTicket
} from '../features/tickets.js';
import {
  APP_OPEN_PREFIX,
  APP_MODAL_PREFIX,
  APP_ACCEPT_PREFIX,
  APP_REJECT_PREFIX,
  handleOpenApplication,
  handleApplicationSubmit,
  handleApplicationDecision
} from '../features/applications.js';
import { SELFROLE_PREFIX, handleSelfRoleToggle } from '../features/selfroles.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Bewerbungs-Formular (Modal)
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith(APP_MODAL_PREFIX)) return await handleApplicationSubmit(interaction);
        return;
      }

      // Button-Klicks
      if (interaction.isButton()) {
        const id = interaction.customId;
        if (id.startsWith(OPEN_BUTTON_PREFIX)) return await handleOpenTicket(interaction);
        if (id === CLOSE_BUTTON_ID) return await handleCloseTicket(interaction);
        if (id.startsWith(APP_OPEN_PREFIX)) return await handleOpenApplication(interaction);
        if (id.startsWith(APP_ACCEPT_PREFIX)) return await handleApplicationDecision(interaction, true);
        if (id.startsWith(APP_REJECT_PREFIX)) return await handleApplicationDecision(interaction, false);
        if (id.startsWith(SELFROLE_PREFIX)) return await handleSelfRoleToggle(interaction);
        return;
      }

      // Slash-Commands
      if (!interaction.isChatInputCommand()) return;
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } catch (err) {
      console.error(`Fehler bei Interaktion (${interaction.commandName || interaction.customId}):`, err);
      if (interaction.isRepliable()) {
        const payload = { content: 'Beim Ausführen ist ein Fehler aufgetreten.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
    }
  }
};
