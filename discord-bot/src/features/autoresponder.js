// Autoresponder: antwortet automatisch, wenn eine Nachricht ein bestimmtes Wort enthält.
import { getGuildConfig } from '../lib/database.js';

export async function handleAutoresponder(message) {
  if (!message.guild || message.author.bot) return;
  const cfg = getGuildConfig(message.guild.id);
  if (!cfg.autoresponders || cfg.autoresponders.length === 0) return;

  const content = (message.content || '').toLowerCase();
  for (const ar of cfg.autoresponders) {
    if (ar.trigger && content.includes(ar.trigger)) {
      message.reply({ content: ar.response, allowedMentions: { repliedUser: true } }).catch(() => {});
      break; // nur die erste passende Antwort
    }
  }
}
