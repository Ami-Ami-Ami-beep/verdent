// Starboard: Nachrichten, die genug ⭐-Reaktionen bekommen, landen in einem Sammel-Kanal.
import { EmbedBuilder } from 'discord.js';
import { getGuildConfig, getStarPost, setStarPost } from '../lib/database.js';

export async function handleReaction(reaction) {
  try {
    if (reaction.partial) await reaction.fetch();
    const msg = reaction.message;
    const guild = msg.guild;
    if (!guild) return;

    const cfg = getGuildConfig(guild.id);
    if (!cfg.starboard.enabled || !cfg.starboard.channelId) return;
    if (reaction.emoji.name !== cfg.starboard.emoji) return;
    if (msg.channelId === cfg.starboard.channelId) return; // Starboard nicht sich selbst spiegeln
    if (reaction.count < cfg.starboard.threshold) return;

    if (msg.partial) await msg.fetch();
    const channel = await guild.channels.fetch(cfg.starboard.channelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
      .setDescription(msg.content || '*(kein Text)*')
      .addFields({ name: 'Original', value: `[Zur Nachricht springen](${msg.url})` })
      .setFooter({ text: `${cfg.starboard.emoji} ${reaction.count} · #${msg.channel.name}` })
      .setTimestamp(msg.createdTimestamp);
    const image = msg.attachments.find((a) => a.contentType?.startsWith('image/'));
    if (image) embed.setImage(image.url);

    const header = `${cfg.starboard.emoji} **${reaction.count}**`;
    const existing = getStarPost(guild.id, msg.id);
    if (existing) {
      const starMsg = await channel.messages.fetch(existing).catch(() => null);
      if (starMsg) {
        await starMsg.edit({ content: header, embeds: [embed] }).catch(() => {});
        return;
      }
    }
    const sent = await channel.send({ content: header, embeds: [embed] });
    setStarPost(guild.id, msg.id, sent.id);
  } catch (err) {
    console.error('Starboard-Fehler:', err);
  }
}
