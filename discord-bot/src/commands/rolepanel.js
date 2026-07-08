import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';
import { buildRolePanel } from '../features/selfroles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('Postet das Selbstrollen-Panel mit Buttons in diesem Kanal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const cfg = getGuildConfig(interaction.guildId);
    if (!cfg.selfRoles || cfg.selfRoles.length === 0) {
      return interaction.reply({ content: 'Es sind keine Selbstrollen konfiguriert. Füge im Dashboard welche hinzu.', flags: MessageFlags.Ephemeral });
    }
    await interaction.channel.send(buildRolePanel(cfg));
    await interaction.reply({ content: '✅ Selbstrollen-Panel gepostet.', flags: MessageFlags.Ephemeral });
  }
};
