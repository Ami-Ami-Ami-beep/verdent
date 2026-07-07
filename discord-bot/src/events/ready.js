import { Events, ActivityType } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Eingeloggt als ${client.user.tag}`);
    console.log(`   Auf ${client.guilds.cache.size} Server(n) aktiv.`);
    client.user.setActivity('auf euren Server aufpassen', { type: ActivityType.Watching });
  }
};
