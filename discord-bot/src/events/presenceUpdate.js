import { Events } from 'discord.js';
import { handlePresence } from '../features/live.js';

export default {
  name: Events.PresenceUpdate,
  async execute(oldPresence, newPresence) {
    try {
      await handlePresence(oldPresence, newPresence);
    } catch (err) {
      console.error('presenceUpdate-Fehler:', err);
    }
  }
};
