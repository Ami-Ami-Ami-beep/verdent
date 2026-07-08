// Selbstrollen: Panel mit Buttons, mit denen sich Mitglieder Rollen selbst geben/nehmen.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';

export const SELFROLE_PREFIX = 'selfrole:';

export function buildRolePanel(cfg) {
  const roles = cfg.selfRoles || [];
  const embed = new EmbedBuilder()
    .setTitle('🎭 Selbstrollen')
    .setDescription('Klick auf einen Button, um dir die Rolle zu geben oder wieder zu entfernen.')
    .setColor(0x5865f2);

  const rows = [];
  let row = new ActionRowBuilder();
  roles.forEach((r, i) => {
    if (i > 0 && i % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
    const btn = new ButtonBuilder()
      .setCustomId(`${SELFROLE_PREFIX}${r.roleId}`)
      .setLabel(r.label || 'Rolle')
      .setStyle(ButtonStyle.Secondary);
    if (r.emoji) {
      try { btn.setEmoji(r.emoji); } catch { /* ungültiges Emoji ignorieren */ }
    }
    row.addComponents(btn);
  });
  if (row.components.length) rows.push(row);

  return { embeds: [embed], components: rows.slice(0, 5) }; // max. 5 Button-Reihen
}

export async function handleSelfRoleToggle(interaction) {
  const roleId = interaction.customId.slice(SELFROLE_PREFIX.length);
  const member = interaction.member;
  const has = member.roles.cache.has(roleId);
  try {
    if (has) {
      await member.roles.remove(roleId);
      await interaction.reply({ content: `➖ Rolle <@&${roleId}> entfernt.`, flags: MessageFlags.Ephemeral });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ content: `➕ Rolle <@&${roleId}> hinzugefügt.`, flags: MessageFlags.Ephemeral });
    }
  } catch {
    await interaction.reply({
      content: 'Konnte die Rolle nicht ändern. Prüfe, ob die Bot-Rolle **höher** steht als die Zielrolle.',
      flags: MessageFlags.Ephemeral
    });
  }
}
