import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { addWarning } from '../lib/database.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Verwarnt ein Mitglied.')
    .addUserOption((o) => o.setName('user').setDescription('Wer soll verwarnt werden?').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund für die Verwarnung').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund');
    const total = addWarning(interaction.guildId, user.id, interaction.user.id, reason);

    await interaction.reply(`⚠️ **${user.tag}** wurde verwarnt. Grund: ${reason}\nVerwarnungen insgesamt: **${total}**`);

    // Betroffenes Mitglied per DM informieren (falls möglich).
    user.send(`Du wurdest auf **${interaction.guild.name}** verwarnt.\nGrund: ${reason}`).catch(() => {});

    const embed = logEmbed('Verwarnung', Colors.mod)
      .setDescription(`**Nutzer:** ${user.tag}\n**Moderator:** <@${interaction.user.id}>\n**Grund:** ${reason}\n**Gesamt:** ${total}`);
    await sendLog(interaction.guild, 'modActions', embed);
  }
};
