import { Events } from 'discord.js';
import { sendLog, logEmbed, Colors } from '../features/logging.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const embed = logEmbed('Nachricht bearbeitet', Colors.edit)
      .setDescription(`**Autor:** <@${newMessage.author.id}>\n**Kanal:** <#${newMessage.channelId}>\n[Zur Nachricht springen](${newMessage.url})`)
      .addFields(
        { name: 'Vorher', value: (oldMessage.content || '—').slice(0, 1000) || '—' },
        { name: 'Nachher', value: (newMessage.content || '—').slice(0, 1000) || '—' }
      );
    await sendLog(newMessage.guild, 'messageEdit', embed);
  }
};
