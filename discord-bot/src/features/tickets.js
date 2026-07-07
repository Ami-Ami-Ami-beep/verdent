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

export const OPEN_BUTTON_ID = 'ticket_open';
export const CLOSE_BUTTON_ID = 'ticket_close';

/** Baut das Panel (Embed + Button), das im Konfig-Kanal gepostet wird. */
export function buildTicketPanel(cfg) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Support-Ticket')
    .setDescription(cfg.tickets.panelMessage)
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPEN_BUTTON_ID)
      .setLabel('Ticket öffnen')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [row] };
}

/** Reaktion auf einen Klick auf "Ticket öffnen". */
export async function handleOpenTicket(interaction) {
  const cfg = getGuildConfig(interaction.guildId);
  if (!cfg.tickets.enabled) {
    return interaction.reply({ content: 'Das Ticket-System ist aktuell deaktiviert.', ephemeral: true });
  }
  if (hasOpenTicket(interaction.guildId, interaction.user.id)) {
    return interaction.reply({ content: 'Du hast bereits ein offenes Ticket.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const number = nextTicketNumber(interaction.guildId);
  const guild = interaction.guild;

  // Berechtigungen: Ticket-Ersteller + Staff-Rolle duerfen sehen, sonst niemand.
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
  for (const staffRoleId of cfg.tickets.staffRoleIds || []) {
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
      parent: cfg.tickets.categoryId || null,
      permissionOverwrites: overwrites
    });
  } catch (err) {
    console.error('Ticket-Kanal konnte nicht erstellt werden:', err);
    return interaction.editReply(
      'Ticket konnte nicht erstellt werden. Prüfe, ob die Kategorie-ID stimmt und der Bot die Rechte "Kanäle verwalten" hat.'
    );
  }

  createTicket(channel.id, guild.id, interaction.user.id, number);

  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${number}`)
    .setDescription(cfg.tickets.welcomeMessage)
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

  const mention = (cfg.tickets.staffRoleIds || []).filter(Boolean).map((id) => `<@&${id}>`).join(' ');
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
