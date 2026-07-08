// Ticket-System: Panel mit Button, privater Ticket-Kanal, Schliessen + Transkript.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import {
  getGuildConfig,
  nextTicketNumber,
  createTicket,
  isTicketChannel,
  hasOpenTicket,
  closeTicket
} from '../lib/database.js';

export const OPEN_BUTTON_PREFIX = 'ticket_open:';
export const CLOSE_BUTTON_ID = 'ticket_close';

/** Baut das Panel: ein Button pro Ticket-Art. */
export function buildTicketPanel(cfg) {
  const types = cfg.tickets.types || [];
  const embed = new EmbedBuilder()
    .setTitle('🎫 Support-Tickets')
    .setDescription(cfg.tickets.panelMessage)
    .setColor(0x5865f2);

  const rows = [];
  let row = new ActionRowBuilder();
  types.forEach((type, i) => {
    if (i > 0 && i % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
    const btn = new ButtonBuilder()
      .setCustomId(`${OPEN_BUTTON_PREFIX}${type.id}`)
      .setLabel(type.name || 'Ticket')
      .setStyle(ButtonStyle.Primary);
    if (type.emoji) {
      try { btn.setEmoji(type.emoji); } catch { /* ungültiges Emoji ignorieren */ }
    }
    row.addComponents(btn);
  });
  if (row.components.length) rows.push(row);

  return { embeds: [embed], components: rows.slice(0, 5) };
}

/** Reaktion auf einen Klick auf einen Ticket-Art-Button. */
export async function handleOpenTicket(interaction) {
  const cfg = getGuildConfig(interaction.guildId);
  if (!cfg.tickets.enabled) {
    return interaction.reply({ content: 'Das Ticket-System ist aktuell deaktiviert.', ephemeral: true });
  }
  const typeId = interaction.customId.slice(OPEN_BUTTON_PREFIX.length);
  const type = (cfg.tickets.types || []).find((t) => t.id === typeId) || (cfg.tickets.types || [])[0];
  if (!type) {
    return interaction.reply({ content: 'Diese Ticket-Art existiert nicht mehr.', ephemeral: true });
  }
  if (hasOpenTicket(interaction.guildId, interaction.user.id, type.id)) {
    return interaction.reply({ content: `Du hast bereits ein offenes **${type.name}**-Ticket.`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const number = nextTicketNumber(interaction.guildId);
  const guild = interaction.guild;

  // Berechtigungen: Ticket-Ersteller + Team-Rollen dieser Art dürfen sehen, sonst niemand.
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];
  for (const staffRoleId of type.staffRoleIds || []) {
    if (!staffRoleId) continue;
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: type.categoryId || null,
      permissionOverwrites: overwrites
    });
  } catch (err) {
    console.error('Ticket-Kanal konnte nicht erstellt werden:', err);
    return interaction.editReply(
      'Ticket konnte nicht erstellt werden. Prüfe, ob die Kategorie stimmt und der Bot die Rechte "Kanäle verwalten" hat.'
    );
  }

  createTicket(channel.id, guild.id, interaction.user.id, number, type.id);

  const embed = new EmbedBuilder()
    .setTitle(`${type.emoji || '🎫'} ${type.name} · Ticket #${number}`)
    .setDescription(type.welcomeMessage || 'Ein Teammitglied meldet sich gleich.')
    .setColor(0x57f287)
    .setFooter({ text: `Erstellt von ${interaction.user.tag}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CLOSE_BUTTON_ID)
      .setLabel('Ticket schließen')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  const mention = (type.staffRoleIds || []).filter(Boolean).map((id) => `<@&${id}>`).join(' ');
  await channel.send({ content: `${mention} <@${interaction.user.id}>`.trim(), embeds: [embed], components: [row] });

  return interaction.editReply(`Dein Ticket wurde erstellt: <#${channel.id}>`);
}

/** Reaktion auf einen Klick auf "Ticket schließen". */
export async function handleCloseTicket(interaction) {
  const channel = interaction.channel;
  if (!isTicketChannel(channel.id)) {
    return interaction.reply({ content: 'Das ist kein Ticket-Kanal.', ephemeral: true });
  }

  await interaction.reply({ content: 'Ticket wird geschlossen und in 5 Sekunden gelöscht …' });
  closeTicket(channel.id);

  const cfg = getGuildConfig(interaction.guildId);

  // Transkript in den Log-Kanal senden (die letzten 100 Nachrichten).
  if (cfg.tickets.logChannelId) {
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = [...messages.values()]
        .reverse()
        .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content}`)
        .join('\n');
      const logChannel = await interaction.guild.channels.fetch(cfg.tickets.logChannelId).catch(() => null);
      if (logChannel) {
        const buffer = Buffer.from(transcript || 'Keine Nachrichten.', 'utf8');
        await logChannel.send({
          content: `📄 Transkript von **${channel.name}** – geschlossen von ${interaction.user.tag}`,
          files: [{ attachment: buffer, name: `${channel.name}.txt` }]
        });
      }
    } catch (err) {
      console.error('Transkript konnte nicht erstellt werden:', err);
    }
  }

  setTimeout(() => channel.delete().catch(() => {}), 5000);
}
