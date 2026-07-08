import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { clearWarnings } from '../lib/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Löscht alle Verwarnungen eines Mitglieds.')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Verwarnungen löschen?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    clearWarnings(interaction.guildId, user.id);
    await interaction.reply(`🧹 Alle Verwarnungen von **${user.tag}** wurden gelöscht.`);
  }
};
