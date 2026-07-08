import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildConfig, getLeaderboard } from '../lib/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Zeigt die Top-Mitglieder nach XP.'),

  async execute(interaction) {
    const cfg = getGuildConfig(interaction.guildId);
    if (!cfg.levels.enabled) {
      return interaction.reply({ content: 'Das Level-System ist deaktiviert.', ephemeral: true });
    }
    const top = getLeaderboard(interaction.guildId, 10);
    if (top.length === 0) {
      return interaction.reply({ content: 'Noch keine XP gesammelt. Schreib ein paar Nachrichten! 😄', ephemeral: true });
    }
    const medals = ['🥇', '🥈', '🥉'];
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Bestenliste – ${interaction.guild.name}`)
      .setColor(0xfee75c)
      .setDescription(
        top.map((e, i) => `${medals[i] || `**${i + 1}.**`} <@${e.userId}> — Level ${e.level} (${e.xp} XP)`).join('\n')
      );
    await interaction.reply({ embeds: [embed] });
  }
};
