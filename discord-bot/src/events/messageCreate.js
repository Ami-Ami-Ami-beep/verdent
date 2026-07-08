import { Events } from 'discord.js';
import { checkMessage } from '../features/automod.js';
import { handleMessageXp } from '../features/levels.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      // AutoMod prüft zuerst; wenn eine Nachricht gelöscht wurde, kein XP vergeben.
      const punished = await checkMessage(message);
      if (!punished) await handleMessageXp(message);
    } catch (err) {
      console.error('messageCreate-Fehler:', err);
    }
  }
};
