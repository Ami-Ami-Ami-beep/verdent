import type { Bot } from "@botpanel/db";
import { isModuleKey, moduleKeys, moduleSchemas, safeModuleConfig, type GuildDto } from "@botpanel/shared";
import { decryptSecret } from "@botpanel/shared/crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { TtlCache } from "../cache.js";
import { prisma, publish } from "../context.js";
import { getBotGuilds, getGuildChannels, getGuildRoles, getManageableGuilds } from "../discord.js";
import { env } from "../env.js";
import { requireAuth } from "../session.js";
import { loadOwnBot } from "./bots.js";

// Discord begrenzt /users/@me/guilds stark, daher kurz zwischenspeichern.
const userGuildCache = new TtlCache<GuildDto[]>(60_000);
const botGuildCache = new TtlCache<GuildDto[]>(30_000);

const botToken = (bot: Bot) => decryptSecret(bot.tokenEnc, env.TOKEN_ENCRYPTION_KEY);

/** Server, auf denen der Bot ist UND der Nutzer „Server verwalten“ hat. */
async function accessibleGuilds(request: FastifyRequest, bot: Bot): Promise<GuildDto[]> {
  const [mine, botGuilds] = await Promise.all([
    userGuildCache.getOrLoad(request.user!.sessionId, () => getManageableGuilds(request.user!.accessToken)),
    botGuildCache.getOrLoad(bot.id, () => getBotGuilds(botToken(bot))),
  ]);
  const allowed = new Set(mine.map((g) => g.id));
  return botGuilds.filter((g) => allowed.has(g.id));
}

type GuildParams = { Params: { botId: string; guildId: string } };

async function loadGuildAccess(request: FastifyRequest<GuildParams>, reply: FastifyReply) {
  const bot = await loadOwnBot(request, reply);
  if (!bot) return null;
  const guilds = await accessibleGuilds(request, bot);
  if (!guilds.some((g) => g.id === request.params.guildId)) {
    reply.code(403).send({ error: "Kein Zugriff auf diesen Server (Bot nicht drauf oder dir fehlt „Server verwalten“)" });
    return null;
  }
  return bot;
}

export async function guildRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { botId: string }; Querystring: { refresh?: string } }>("/api/bots/:botId/guilds", async (request, reply) => {
    const bot = await loadOwnBot(request, reply);
    if (!bot) return;
    if (request.query.refresh) {
      userGuildCache.delete(request.user!.sessionId);
      botGuildCache.delete(bot.id);
    }
    return accessibleGuilds(request, bot);
  });

  app.get<GuildParams>("/api/bots/:botId/guilds/:guildId/channels", async (request, reply) => {
    const bot = await loadGuildAccess(request, reply);
    if (!bot) return;
    return getGuildChannels(botToken(bot), request.params.guildId);
  });

  app.get<GuildParams>("/api/bots/:botId/guilds/:guildId/roles", async (request, reply) => {
    const bot = await loadGuildAccess(request, reply);
    if (!bot) return;
    return getGuildRoles(botToken(bot), request.params.guildId);
  });

  /** Alle Modul-Konfigurationen eines Servers, fehlende mit Standardwerten. */
  app.get<GuildParams>("/api/bots/:botId/guilds/:guildId/modules", async (request, reply) => {
    const bot = await loadGuildAccess(request, reply);
    if (!bot) return;
    const rows = await prisma.moduleConfig.findMany({ where: { botId: bot.id, guildId: request.params.guildId } });
    const byKey = new Map(rows.map((r) => [r.module, r.config]));
    return Object.fromEntries(moduleKeys.map((key) => [key, safeModuleConfig(key, byKey.get(key))]));
  });

  app.put<GuildParams & { Params: { module: string } }>(
    "/api/bots/:botId/guilds/:guildId/modules/:module",
    async (request, reply) => {
      const { guildId, module } = request.params;
      if (!isModuleKey(module)) return reply.code(404).send({ error: "Unbekanntes Modul" });
      const bot = await loadGuildAccess(request, reply);
      if (!bot) return;

      const parsed = moduleSchemas[module].safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Ungültige Konfiguration", issues: parsed.error.issues });
      }
      await prisma.moduleConfig.upsert({
        where: { botId_guildId_module: { botId: bot.id, guildId, module } },
        create: { botId: bot.id, guildId, module, config: parsed.data },
        update: { config: parsed.data },
      });
      await publish({ type: "config.updated", botId: bot.id, guildId, module });
      return parsed.data;
    },
  );
}
