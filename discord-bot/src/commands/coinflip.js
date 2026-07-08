import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Wirft eine Münze.'),

  async execute(interaction) {
    const heads = Math.random() < 0.5;
    await interaction.reply(heads ? '🪙 **Kopf!**' : '🪙 **Zahl!**');
  }
};
