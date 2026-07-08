import { SlashCommandBuilder } from 'discord.js';

const ANSWERS = [
  'Ja, definitiv.', 'Ziemlich sicher ja.', 'Sieht gut aus.', 'Ohne Zweifel.',
  'Vielleicht.', 'Frag später nochmal.', 'Kann ich gerade nicht sagen.',
  'Eher nicht.', 'Meine Quellen sagen nein.', 'Auf keinen Fall.'
];

export default {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Stell der magischen 8-Ball eine Ja/Nein-Frage.')
    .addStringOption((o) => o.setName('frage').setDescription('Deine Frage').setRequired(true)),

  async execute(interaction) {
    const question = interaction.options.getString('frage');
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    await interaction.reply(`🎱 **Frage:** ${question}\n**Antwort:** ${answer}`);
  }
};
