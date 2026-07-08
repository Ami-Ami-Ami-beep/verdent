import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { buildApplicationPanel } from '../features/applications.js';

export default {
  data: new SlashCommandBuilder()
    .setName('applicationpanel')
    .setDescription('Postet das Bewerbungs-Panel mit Button in diesem Kanal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const cfg = getGuildConfig(interaction.guildId);
    if (!cfg.applications.enabled) {
      return interaction.reply({ content: 'Das Bewerbungssystem ist deaktiviert. Aktiviere es zuerst im Dashboard.', flags: MessageFlags.Ephemeral });
    }
    if (!cfg.applications.types || cfg.applications.types.length === 0) {
      return interaction.reply({ content: 'Es ist noch keine Bewerbungs-Art konfiguriert. Füge im Dashboard mindestens eine hinzu.', flags: MessageFlags.Ephemeral });
    }
    await interaction.channel.send(buildApplicationPanel(cfg));
    await interaction.reply({ content: '✅ Bewerbungs-Panel gepostet.', flags: MessageFlags.Ephemeral });
  }
};
