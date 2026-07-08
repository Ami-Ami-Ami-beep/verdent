import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Zeigt die Reaktionszeit des Bots.'),

  async execute(interaction) {
    await interaction.reply({ content: '🏓 Pong!', fetchReply: true }).then((sent) => {
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      interaction.editReply(`🏓 Pong! Latenz: **${latency}ms** · API: **${Math.round(interaction.client.ws.ping)}ms**`);
    });
  }
};
