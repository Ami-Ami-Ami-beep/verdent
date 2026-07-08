import { Events } from 'discord.js';
import { checkMessage } from '../features/automod.js';
import { handleMessageXp } from '../features/levels.js';
import { handleCounting } from '../features/counting.js';
import { handleAutoresponder } from '../features/autoresponder.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      // Zählkanal zuerst – wenn dort, keine weitere Verarbeitung.
      if (await handleCounting(message)) return;

      // AutoMod prüft; wenn eine Nachricht gelöscht wurde, nichts weiter.
      const punished = await checkMessage(message);
      if (punished) return;

      await handleAutoresponder(message);
      await handleMessageXp(message);
    } catch (err) {
      console.error('messageCreate-Fehler:', err);
    }
  }
};
