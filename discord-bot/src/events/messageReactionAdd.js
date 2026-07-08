import { Events } from 'discord.js';
import { handleReaction } from '../features/starboard.js';

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;
    try {
      await handleReaction(reaction);
    } catch (err) {
      console.error('messageReactionAdd-Fehler:', err);
    }
  }
};
