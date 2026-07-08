import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { getWarnings } from '../lib/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Zeigt die Verwarnungen eines Mitglieds.')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Verwarnungen?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const warnings = getWarnings(interaction.guildId, user.id);

    if (warnings.length === 0) {
      return interaction.reply({ content: `**${user.tag}** hat keine Verwarnungen. 🎉`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Verwarnungen von ${user.tag}`)
      .setColor(0xfee75c)
      .setDescription(
        warnings
          .map((w, i) => {
            const date = new Date(w.created_at);
            return `**${i + 1}.** ${w.reason}\n· von <@${w.moderator_id}> · <t:${Math.floor(date.getTime() / 1000)}:R>`;
          })
          .join('\n\n')
      )
      .setFooter({ text: `Insgesamt ${warnings.length} Verwarnung(en)` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
