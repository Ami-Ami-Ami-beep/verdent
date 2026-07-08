import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { liftLockdown } from '../features/antiraid.js';

export const lock = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Sperrt den aktuellen Kanal (niemand kann mehr schreiben).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await interaction.reply('🔒 Kanal gesperrt.');
  }
};

export const unlock = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Hebt die Sperre auf – optional serverweit (nach Lockdown).')
    .addBooleanOption((o) => o.setName('serverweit').setDescription('Alle Kanäle entsperren (nach Anti-Raid-Lockdown)?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (interaction.options.getBoolean('serverweit')) {
      await interaction.deferReply();
      await liftLockdown(interaction.guild);
      return interaction.editReply('🔓 Serverweiter Lockdown aufgehoben.');
    }
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.reply('🔓 Kanal entsperrt.');
  }
};

// Diese Datei exportiert zwei Befehle – der Loader unterstützt das über `commands`.
export default [lock, unlock];
