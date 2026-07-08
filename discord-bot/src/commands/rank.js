import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildConfig, getUserLevel, xpForLevel } from '../lib/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Zeigt dein Level (oder das eines anderen Mitglieds).')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Rang?')),

  async execute(interaction) {
    const cfg = getGuildConfig(interaction.guildId);
    if (!cfg.levels.enabled) {
      return interaction.reply({ content: 'Das Level-System ist deaktiviert.', ephemeral: true });
    }
    const user = interaction.options.getUser('user') || interaction.user;
    const { xp, level, rank } = getUserLevel(interaction.guildId, user.id);
    const next = xpForLevel(level + 1);
    const current = xpForLevel(level);

    const embed = new EmbedBuilder()
      .setTitle(`Rang von ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .setColor(0x5865f2)
      .addFields(
        { name: 'Level', value: `**${level}**`, inline: true },
        { name: 'Rang', value: `#${rank}`, inline: true },
        { name: 'XP', value: `${xp} (${xp - current}/${next - current} bis Level ${level + 1})`, inline: false }
      );
    await interaction.reply({ embeds: [embed] });
  }
};
