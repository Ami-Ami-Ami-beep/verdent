import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Wirft ein Mitglied vom Server.')
    .addUserOption((o) => o.setName('user').setDescription('Wer soll gekickt werden?').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund für den Kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral });
    if (!member.kickable) {
      return interaction.reply({ content: 'Ich kann dieses Mitglied nicht kicken (zu hohe Rolle?).', flags: MessageFlags.Ephemeral });
    }

    await member.kick(`${interaction.user.tag}: ${reason}`);
    await interaction.reply(`👢 **${user.tag}** wurde gekickt. Grund: ${reason}`);

    const embed = logEmbed('Mitglied gekickt', Colors.mod)
      .setDescription(`**Nutzer:** ${user.tag}\n**Moderator:** <@${interaction.user.id}>\n**Grund:** ${reason}`);
    await sendLog(interaction.guild, 'modActions', embed);
  }
};
