import { Events } from 'discord.js';
import { checkMessage } from '../features/automod.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      await checkMessage(message);
    } catch (err) {
      console.error('AutoMod-Fehler:', err);
    }
  }
};
