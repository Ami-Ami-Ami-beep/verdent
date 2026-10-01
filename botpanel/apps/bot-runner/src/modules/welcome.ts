import { renderTemplate } from "@botpanel/shared";
import { EmbedBuilder, type GuildMember, type PartialGuildMember } from "discord.js";
import type { BotModule, ModuleContext } from "./types.js";

function templateVars(member: GuildMember | PartialGuildMember) {
  return {
    user: `<@${member.id}>`,
    username: member.user?.username ?? "Unbekannt",
    server: member.guild.name,
    memberCount: member.guild.memberCount,
  };
}

async function sendTo(
  ctx: ModuleContext,
  member: GuildMember | PartialGuildMember,
  channelId: string,
  text: string,
  embed: { title: string; color: string } | null,
) {
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isSendable()) {
    ctx.log.warn(`Kanal ${channelId} auf ${member.guild.id} nicht gefunden oder nicht beschreibbar`);
    return;
  }
  const allowedMentions = { users: [member.id] };
  if (embed) {
    const e = new EmbedBuilder()
      .setTitle(embed.title)
      .setDescription(text)
      .setColor(embed.color as `#${string}`)
      .setThumbnail(member.user?.displayAvatarURL() ?? null);
    await channel.send({ content: `<@${member.id}>`, embeds: [e], allowedMentions });
  } else {
    await channel.send({ content: text, allowedMentions });
  }
}

export const welcomeModule: BotModule = {
  key: "welcome",
  register(ctx) {
    ctx.client.on("guildMemberAdd", async (member) => {
      const cfg = ctx.config.get(member.guild.id, "welcome");
      if (!cfg.enabled || member.user.bot) return;
      try {
        if (cfg.autoRoleIds.length > 0) {
          await member.roles.add(cfg.autoRoleIds, "Autorolle (Willkommen)").catch((err: unknown) => {
            ctx.log.warn(`Autorollen auf ${member.guild.id} fehlgeschlagen (Bot-Rolle zu niedrig?)`, err);
          });
        }
        if (cfg.channelId) {
          const text = renderTemplate(cfg.message, templateVars(member));
          await sendTo(ctx, member, cfg.channelId, text, cfg.useEmbed ? { title: cfg.embedTitle, color: cfg.embedColor } : null);
        }
      } catch (err) {
        ctx.log.error(`Willkommen auf ${member.guild.id} fehlgeschlagen`, err);
      }
    });

    ctx.client.on("guildMemberRemove", async (member) => {
      const cfg = ctx.config.get(member.guild.id, "welcome");
      if (!cfg.enabled || !cfg.leaveEnabled || !cfg.leaveChannelId || member.user?.bot) return;
      try {
        const text = renderTemplate(cfg.leaveMessage, templateVars(member));
        await sendTo(ctx, member, cfg.leaveChannelId, text, null);
      } catch (err) {
        ctx.log.error(`Abschied auf ${member.guild.id} fehlgeschlagen`, err);
      }
    });
  },
};
