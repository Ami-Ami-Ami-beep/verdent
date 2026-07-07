import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt ein Mitglied vom Server.')
    .addUserOption((o) => o.setName('user').setDescription('Wer soll gebannt werden?').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund für den Bann'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: 'Ich kann dieses Mitglied nicht bannen (zu hohe Rolle?).', flags: MessageFlags.Ephemeral });
    }

    await interaction.guild.members.ban(user.id, { reason: `${interaction.user.tag}: ${reason}` });
    await interaction.reply(`🔨 **${user.tag}** wurde gebannt. Grund: ${reason}`);

    const embed = logEmbed('Mitglied gebannt', Colors.mod)
      .setDescription(`**Nutzer:** ${user.tag}\n**Moderator:** <@${interaction.user.id}>\n**Grund:** ${reason}`);
    await sendLog(interaction.guild, 'modActions', embed);
  }
};
