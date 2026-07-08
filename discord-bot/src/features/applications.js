// Bewerbungssystem: Panel-Button → Fragen-Formular (Modal) → Review-Kanal mit Annehmen/Ablehnen.
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

export const APP_OPEN_ID = 'app_open';
export const APP_MODAL_ID = 'app_modal';
export const APP_ACCEPT_PREFIX = 'app_accept:';
export const APP_REJECT_PREFIX = 'app_reject:';

const DEFAULT_QUESTIONS = ['Warum möchtest du dich bewerben?'];

export function buildApplicationPanel(cfg) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Bewerbung')
    .setDescription(cfg.applications.panelMessage || 'Bewirb dich für unser Team!')
    .setColor(0x5865f2);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(APP_OPEN_ID).setLabel('Jetzt bewerben').setEmoji('📝').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

/** Button "Jetzt bewerben" → zeigt das Fragen-Formular. */
export async function handleOpenApplication(interaction) {
  const cfg = getGuildConfig(interaction.guildId);
  if (!cfg.applications.enabled) {
    return interaction.reply({ content: 'Das Bewerbungssystem ist aktuell deaktiviert.', flags: MessageFlags.Ephemeral });
  }
  const questions = cfg.applications.questions.length ? cfg.applications.questions : DEFAULT_QUESTIONS;
  const modal = new ModalBuilder().setCustomId(APP_MODAL_ID).setTitle('Bewerbung');
  questions.slice(0, 5).forEach((q, i) => {
    const input = new TextInputBuilder()
      .setCustomId(`q${i}`)
      .setLabel(q.slice(0, 45)) // Discord-Limit für Labels
      .setStyle(q.length > 60 ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(1000);
    if (q.length > 45) input.setPlaceholder(q.slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  });
  await interaction.showModal(modal);
}

/** Formular abgeschickt → Bewerbung in den Review-Kanal posten. */
export async function handleApplicationSubmit(interaction) {
  const cfg = getGuildConfig(interaction.guildId);
  const questions = cfg.applications.questions.length ? cfg.applications.questions : DEFAULT_QUESTIONS;

  const embed = new EmbedBuilder()
    .setTitle('📝 Neue Bewerbung')
    .setColor(0xfee75c)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setFooter({ text: `Bewerber: ${interaction.user.id}` })
    .setTimestamp();

  questions.slice(0, 5).forEach((q, i) => {
    const answer = interaction.fields.getTextInputValue(`q${i}`);
    embed.addFields({ name: q.slice(0, 256), value: (answer || '—').slice(0, 1024) });
  });

  const channel = cfg.applications.reviewChannelId
    ? await interaction.guild.channels.fetch(cfg.applications.reviewChannelId).catch(() => null)
    : null;
  if (!channel) {
    return interaction.reply({
      content: 'Deine Bewerbung konnte nicht eingereicht werden – der Review-Kanal ist nicht eingerichtet. Bitte melde dich bei einem Admin.',
      flags: MessageFlags.Ephemeral
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${APP_ACCEPT_PREFIX}${interaction.user.id}`).setLabel('Annehmen').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${APP_REJECT_PREFIX}${interaction.user.id}`).setLabel('Ablehnen').setEmoji('❌').setStyle(ButtonStyle.Danger)
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
  const applicantId = interaction.customId.slice(prefix.length);
  const member = await interaction.guild.members.fetch(applicantId).catch(() => null);

  if (accept && cfg.applications.acceptedRoleId && member) {
    await member.roles.add(cfg.applications.acceptedRoleId).catch(() => {});
  }

  const user = member?.user ?? (await interaction.client.users.fetch(applicantId).catch(() => null));
  user?.send(
    accept
      ? `🎉 Deine Bewerbung auf **${interaction.guild.name}** wurde **angenommen**!`
      : `Deine Bewerbung auf **${interaction.guild.name}** wurde leider **abgelehnt**.`
  ).catch(() => {});

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(accept ? 0x57f287 : 0xed4245)
    .addFields({ name: accept ? '✅ Angenommen von' : '❌ Abgelehnt von', value: `<@${interaction.user.id}>` });
  await interaction.update({ embeds: [embed], components: [] });
}
