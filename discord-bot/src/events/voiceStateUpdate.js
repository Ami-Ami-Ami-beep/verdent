import { Events } from 'discord.js';
import { handleVoice } from '../features/tempvoice.js';

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      await handleVoice(oldState, newState);
    } catch (err) {
      console.error('voiceStateUpdate-Fehler:', err);
    }
  }
};
