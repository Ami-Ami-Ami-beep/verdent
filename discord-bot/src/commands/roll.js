import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Würfelt eine Zahl.')
    .addIntegerOption((o) => o.setName('seiten').setDescription('Wie viele Seiten? (Standard 6)').setMinValue(2).setMaxValue(1000)),

  async execute(interaction) {
    const sides = interaction.options.getInteger('seiten') || 6;
    const result = Math.floor(Math.random() * sides) + 1;
    await interaction.reply(`🎲 Du würfelst eine **${result}** (1–${sides}).`);
  }
};
