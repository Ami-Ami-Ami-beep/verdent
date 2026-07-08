import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Startet ein Giveaway (Verlosung) mit 🎉-Reaktion.')
    .addIntegerOption((o) => o.setName('minuten').setDescription('Dauer in Minuten').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption((o) => o.setName('gewinner').setDescription('Anzahl Gewinner').setRequired(true).setMinValue(1).setMaxValue(20))
    .addStringOption((o) => o.setName('preis').setDescription('Was wird verlost?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const minutes = interaction.options.getInteger('minuten');
    const winners = interaction.options.getInteger('gewinner');
    const prize = interaction.options.getString('preis');
    const endsAt = Math.floor((Date.now() + minutes * 60_000) / 1000);

    const embed = new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(`**Preis:** ${prize}\n**Gewinner:** ${winners}\nReagiere mit 🎉 um teilzunehmen!\n\nEndet <t:${endsAt}:R>`)
      .setColor(0xeb459e)
      .setTimestamp(new Date(Date.now() + minutes * 60_000));

    const msg = await interaction.channel.send({ embeds: [embed] });
    await msg.react('🎉');
    await interaction.reply({ content: '✅ Giveaway gestartet!', flags: MessageFlags.Ephemeral });

    // Hinweis: läuft über einen Timer – überlebt keinen Bot-Neustart.
    setTimeout(async () => {
      const fetched = await interaction.channel.messages.fetch(msg.id).catch(() => null);
      if (!fetched) return;
      const reaction = fetched.reactions.cache.get('🎉');
      const users = reaction ? (await reaction.users.fetch()).filter((u) => !u.bot) : new Map();
      const pool = [...users.values()];
      if (pool.length === 0) {
        return interaction.channel.send(`Das Giveaway für **${prize}** endete – leider ohne Teilnehmer. 😢`);
      }
      const chosen = [];
      for (let i = 0; i < Math.min(winners, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length);
        chosen.push(pool.splice(idx, 1)[0]);
      }
      const resultEmbed = new EmbedBuilder()
        .setTitle('🎉 Giveaway beendet')
        .setDescription(`**Preis:** ${prize}\n**Gewinner:** ${chosen.map((u) => `<@${u.id}>`).join(', ')}`)
        .setColor(0x57f287);
      await interaction.channel.send({ content: `Glückwunsch ${chosen.map((u) => `<@${u.id}>`).join(', ')}! 🎉`, embeds: [resultEmbed] });
    }, minutes * 60_000);
  }
};
