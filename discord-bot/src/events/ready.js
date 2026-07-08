import { Events, ActivityType } from 'discord.js';
import { deployCommands } from '../lib/deploy.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Eingeloggt als ${client.user.tag}`);
    console.log(`   Auf ${client.guilds.cache.size} Server(n) aktiv.`);
    client.user.setActivity('auf euren Server aufpassen', { type: ActivityType.Watching });

    // Slash-Commands automatisch registrieren (praktisch beim Hosting).
    // Mit AUTO_DEPLOY=0 in der .env lässt sich das abschalten.
    if (process.env.AUTO_DEPLOY === '0' || process.env.AUTO_DEPLOY === 'false') return;
    try {
      const commands = [...client.commands.values()];
      const count = await deployCommands(commands, {
        token: client.token,
        clientId: client.application.id,
        guildId: process.env.GUILD_ID || undefined
      });
      console.log(`   ${count} Slash-Command(s) registriert (${process.env.GUILD_ID ? 'Server' : 'global'}).`);
    } catch (err) {
      console.error('⚠️  Slash-Commands konnten nicht automatisch registriert werden:', err.message);
    }
  }
};
