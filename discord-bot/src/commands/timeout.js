import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Versetzt ein Mitglied in einen Timeout (Stummschaltung).')
    .addUserOption((o) => o.setName('user').setDescription('Wer soll den Timeout bekommen?').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('minuten').setDescription('Dauer in Minuten (max. 40320 = 28 Tage)').setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption((o) => o.setName('grund').setDescription('Grund'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minuten');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral });
    if (!member.moderatable) {
      return interaction.reply({ content: 'Ich kann dieses Mitglied nicht timeouten (zu hohe Rolle?).', flags: MessageFlags.Ephemeral });
    }

    await member.timeout(minutes * 60_000, `${interaction.user.tag}: ${reason}`);
    await interaction.reply(`🔇 **${user.tag}** hat für **${minutes} Min.** einen Timeout. Grund: ${reason}`);

    const embed = logEmbed('Timeout', Colors.mod)
      .setDescription(`**Nutzer:** ${user.tag}\n**Dauer:** ${minutes} Min.\n**Moderator:** <@${interaction.user.id}>\n**Grund:** ${reason}`);
    await sendLog(interaction.guild, 'modActions', embed);
  }
};
