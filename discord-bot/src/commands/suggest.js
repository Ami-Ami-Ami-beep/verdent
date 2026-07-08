import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getGuildConfig } from '../lib/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Reiche einen Vorschlag ein.')
    .addStringOption((o) => o.setName('vorschlag').setDescription('Dein Vorschlag').setRequired(true)),

  async execute(interaction) {
    const cfg = getGuildConfig(interaction.guildId);
    if (!cfg.suggestions.enabled || !cfg.suggestions.channelId) {
      return interaction.reply({ content: 'Das Vorschlagssystem ist nicht eingerichtet.', flags: MessageFlags.Ephemeral });
    }
    const channel = await interaction.guild.channels.fetch(cfg.suggestions.channelId).catch(() => null);
    if (!channel) {
      return interaction.reply({ content: 'Der Vorschlags-Kanal wurde nicht gefunden.', flags: MessageFlags.Ephemeral });
    }
    const text = interaction.options.getString('vorschlag');
    const embed = new EmbedBuilder()
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setDescription(text)
      .setColor(0x5865f2)
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    await msg.react('👍').catch(() => {});
    await msg.react('👎').catch(() => {});
    await interaction.reply({ content: `✅ Dein Vorschlag wurde in <#${channel.id}> gepostet.`, flags: MessageFlags.Ephemeral });
  }
};
