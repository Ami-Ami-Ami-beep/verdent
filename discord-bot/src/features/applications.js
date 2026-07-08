// Bewerbungssystem: Panel mit Button je Bewerbungs-Art → Fragen-Formular (Modal)
// → Review-Kanal der Art mit Annehmen/Ablehnen.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { getGuildConfig } from '../lib/database.js';

export const APP_OPEN_PREFIX = 'app_open:';
export const APP_MODAL_PREFIX = 'app_modal:';
export const APP_ACCEPT_PREFIX = 'app_accept:';
export const APP_REJECT_PREFIX = 'app_reject:';

const DEFAULT_QUESTIONS = ['Warum möchtest du dich bewerben?'];

function findType(cfg, typeId) {
  return (cfg.applications.types || []).find((t) => t.id === typeId) || (cfg.applications.types || [])[0];
}

/** Panel: ein Button pro Bewerbungs-Art. */
export function buildApplicationPanel(cfg) {
  const types = cfg.applications.types || [];
  const embed = new EmbedBuilder()
    .setTitle('📝 Bewerbung')
    .setDescription(cfg.applications.panelMessage || 'Bewirb dich für unser Team!')
    .setColor(0x5865f2);

  const rows = [];
  let row = new ActionRowBuilder();
  types.forEach((type, i) => {
    if (i > 0 && i % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
    const btn = new ButtonBuilder()
      .setCustomId(`${APP_OPEN_PREFIX}${type.id}`)
      .setLabel(type.name || 'Bewerbung')
      .setStyle(ButtonStyle.Success);
    if (type.emoji) {
      try { btn.setEmoji(type.emoji); } catch { /* ungültiges Emoji ignorieren */ }
    }
    row.addComponents(btn);
  });
  if (row.components.length) rows.push(row);

  return { embeds: [embed], components: rows.slice(0, 5) };
}

/** Button einer Bewerbungs-Art → zeigt das Fragen-Formular. */
export async function handleOpenApplication(interaction) {
  const cfg = getGuildConfig(interaction.guildId);
  if (!cfg.applications.enabled) {
    return interaction.reply({ content: 'Das Bewerbungssystem ist aktuell deaktiviert.', flags: MessageFlags.Ephemeral });
  }
  const typeId = interaction.customId.slice(APP_OPEN_PREFIX.length);
  const type = findType(cfg, typeId);
  if (!type) {
    return interaction.reply({ content: 'Diese Bewerbungs-Art existiert nicht mehr.', flags: MessageFlags.Ephemeral });
  }

  const questions = type.questions.length ? type.questions : DEFAULT_QUESTIONS;
  const modal = new ModalBuilder().setCustomId(`${APP_MODAL_PREFIX}${type.id}`).setTitle(`Bewerbung: ${type.name}`.slice(0, 45));
  questions.slice(0, 5).forEach((q, i) => {
    const input = new TextInputBuilder()
      .setCustomId(`q${i}`)
      .setLabel(q.slice(0, 45))
      .setStyle(q.length > 60 ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(1000);
    if (q.length > 45) input.setPlaceholder(q.slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  });
  await interaction.showModal(modal);
}

/** Formular abgeschickt → Bewerbung in den Review-Kanal der Art posten. */
export async function handleApplicationSubmit(interaction) {
  const cfg = getGuildConfig(interaction.guildId);
  const typeId = interaction.customId.slice(APP_MODAL_PREFIX.length);
  const type = findType(cfg, typeId);
  if (!type) {
    return interaction.reply({ content: 'Diese Bewerbungs-Art existiert nicht mehr.', flags: MessageFlags.Ephemeral });
  }
  const questions = type.questions.length ? type.questions : DEFAULT_QUESTIONS;

  const embed = new EmbedBuilder()
    .setTitle(`📝 Neue Bewerbung: ${type.name}`)
    .setColor(0xfee75c)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setFooter({ text: `Bewerber: ${interaction.user.id}` })
    .setTimestamp();

  questions.slice(0, 5).forEach((q, i) => {
    const answer = interaction.fields.getTextInputValue(`q${i}`);
    embed.addFields({ name: q.slice(0, 256), value: (answer || '—').slice(0, 1024) });
  });

  const channel = type.reviewChannelId
    ? await interaction.guild.channels.fetch(type.reviewChannelId).catch(() => null)
    : null;
  if (!channel) {
    return interaction.reply({
      content: 'Deine Bewerbung konnte nicht eingereicht werden – der Review-Kanal dieser Art ist nicht eingerichtet. Bitte melde dich bei einem Admin.',
      flags: MessageFlags.Ephemeral
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${APP_ACCEPT_PREFIX}${type.id}:${interaction.user.id}`).setLabel('Annehmen').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${APP_REJECT_PREFIX}${type.id}:${interaction.user.id}`).setLabel('Ablehnen').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Deine Bewerbung wurde eingereicht! Vielen Dank.', flags: MessageFlags.Ephemeral });
}

/** Annehmen/Ablehnen-Button im Review-Kanal. */
export async function handleApplicationDecision(interaction, accept) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'Dafür fehlt dir die Berechtigung (Server verwalten).', flags: MessageFlags.Ephemeral });
  }
  const cfg = getGuildConfig(interaction.guildId);
  const prefix = accept ? APP_ACCEPT_PREFIX : APP_REJECT_PREFIX;
  // customId = <prefix><typeId>:<userId>
  const rest = interaction.customId.slice(prefix.length);
  const sep = rest.lastIndexOf(':');
  const typeId = rest.slice(0, sep);
  const applicantId = rest.slice(sep + 1);
  const type = findType(cfg, typeId);
  const member = await interaction.guild.members.fetch(applicantId).catch(() => null);

  if (accept && type?.acceptedRoleId && member) {
    await member.roles.add(type.acceptedRoleId).catch(() => {});
  }

  const user = member?.user ?? (await interaction.client.users.fetch(applicantId).catch(() => null));
  user?.send(
    accept
      ? `🎉 Deine Bewerbung (**${type?.name || 'Team'}**) auf **${interaction.guild.name}** wurde **angenommen**!`
      : `Deine Bewerbung (**${type?.name || 'Team'}**) auf **${interaction.guild.name}** wurde leider **abgelehnt**.`
  ).catch(() => {});

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(accept ? 0x57f287 : 0xed4245)
    .addFields({ name: accept ? '✅ Angenommen von' : '❌ Abgelehnt von', value: `<@${interaction.user.id}>` });
  await interaction.update({ embeds: [embed], components: [] });
}
