import { Events } from 'discord.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;
    const embed = logEmbed('Nachricht gelöscht', Colors.delete)
      .setDescription(`**Autor:** ${message.author ? `<@${message.author.id}>` : 'Unbekannt'}\n**Kanal:** <#${message.channelId}>`)
      .addFields({ name: 'Inhalt', value: (message.content || '—').slice(0, 1000) || '—' });
    await sendLog(message.guild, 'messageDelete', embed);
  }
};
