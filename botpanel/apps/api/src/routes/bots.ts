import type { Bot } from "@botpanel/db";
import type { BotDto } from "@botpanel/shared";
import { encryptSecret } from "@botpanel/shared/crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma, publish } from "../context.js";
import { avatarUrl, botInviteUrl, DiscordApiError, getBotUser } from "../discord.js";
import { env } from "../env.js";
import { requireAuth } from "../session.js";
import { getStatuses } from "../status.js";

const createBody = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  token: z.string().trim().min(50).max(100),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  partnerBotId: z.string().nullable().optional(),
});

async function toDtos(bots: Bot[]): Promise<BotDto[]> {
  const statuses = await getStatuses(bots.map((b) => b.id));
  return bots.map((b) => ({
    id: b.id,
    name: b.name,
    applicationId: b.applicationId,
    avatarUrl: avatarUrl(b.applicationId, b.avatar),
    enabled: b.enabled,
    partnerBotId: b.partnerBotId,
    createdAt: b.createdAt.toISOString(),
    status: statuses.get(b.id)!,
  }));
}

/** Lädt einen Bot des angemeldeten Nutzers oder antwortet mit 404. */
export async function loadOwnBot(request: FastifyRequest<{ Params: { botId: string } }>, reply: FastifyReply) {
  const bot = await prisma.bot.findFirst({ where: { id: request.params.botId, ownerId: request.user!.userId } });
  if (!bot) {
    reply.code(404).send({ error: "Bot nicht gefunden" });
    return null;
  }
  return bot;
}

export async function botRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/bots", async (request) => {
    const bots = await prisma.bot.findMany({ where: { ownerId: request.user!.userId }, orderBy: { createdAt: "asc" } });
    return toDtos(bots);
  });

  app.post("/api/bots", async (request, reply) => {
    const body = createBody.parse(request.body);
    let botUser;
    try {
      botUser = await getBotUser(body.token);
    } catch (err) {
      if (err instanceof DiscordApiError && (err.status === 401 || err.status === 400)) {
        return reply.code(400).send({ error: "Ungültiger Bot-Token" });
      }
      throw err;
    }
    const existing = await prisma.bot.findUnique({ where: { applicationId: botUser.id } });
    if (existing) return reply.code(409).send({ error: "Dieser Bot ist bereits registriert" });

    const bot = await prisma.bot.create({
      data: {
        ownerId: request.user!.userId,
        name: body.name ?? botUser.username,
        applicationId: botUser.id,
        avatar: botUser.avatar,
        tokenEnc: encryptSecret(body.token, env.TOKEN_ENCRYPTION_KEY),
      },
    });
    return reply.code(201).send((await toDtos([bot]))[0]);
  });

  app.patch<{ Params: { botId: string } }>("/api/bots/:botId", async (request, reply) => {
    const bot = await loadOwnBot(request, reply);
    if (!bot) return;
    const body = updateBody.parse(request.body);

    if (body.partnerBotId !== undefined) {
      const partnerId = body.partnerBotId;
      if (partnerId !== null) {
        if (partnerId === bot.id) return reply.code(400).send({ error: "Ein Bot kann nicht sein eigener Partner sein" });
        const partner = await prisma.bot.findFirst({ where: { id: partnerId, ownerId: request.user!.userId } });
        if (!partner) return reply.code(404).send({ error: "Partner-Bot nicht gefunden" });
      }
      // Partnerschaft ist immer gegenseitig: alte Verbindungen beider Bots lösen, neue in beide Richtungen setzen.
      await prisma.$transaction(async (tx) => {
        const involved = [bot.id, ...(partnerId ? [partnerId] : [])];
        await tx.bot.updateMany({ where: { partnerBotId: { in: involved } }, data: { partnerBotId: null } });
        await tx.bot.updateMany({ where: { id: { in: involved } }, data: { partnerBotId: null } });
        if (partnerId) {
          await tx.bot.update({ where: { id: bot.id }, data: { partnerBotId: partnerId } });
          await tx.bot.update({ where: { id: partnerId }, data: { partnerBotId: bot.id } });
        }
      });
      await publish({ type: "bot.restart", botId: bot.id });
      if (partnerId) await publish({ type: "bot.restart", botId: partnerId });
    }

    const updated = await prisma.bot.update({ where: { id: bot.id }, data: { name: body.name } });
    return (await toDtos([updated]))[0];
  });

  app.delete<{ Params: { botId: string } }>("/api/bots/:botId", async (request, reply) => {
    const bot = await loadOwnBot(request, reply);
    if (!bot) return;
    await publish({ type: "bot.stop", botId: bot.id });
    await prisma.bot.delete({ where: { id: bot.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { botId: string } }>("/api/bots/:botId/start", async (request, reply) => {
    const bot = await loadOwnBot(request, reply);
    if (!bot) return;
    await prisma.bot.update({ where: { id: bot.id }, data: { enabled: true } });
    await publish({ type: "bot.start", botId: bot.id });
    return { ok: true };
  });

  app.post<{ Params: { botId: string } }>("/api/bots/:botId/stop", async (request, reply) => {
    const bot = await loadOwnBot(request, reply);
    if (!bot) return;
    await prisma.bot.update({ where: { id: bot.id }, data: { enabled: false } });
    await publish({ type: "bot.stop", botId: bot.id });
    return { ok: true };
  });

  app.get<{ Params: { botId: string } }>("/api/bots/:botId/invite", async (request, reply) => {
    const bot = await loadOwnBot(request, reply);
    if (!bot) return;
    return { url: botInviteUrl(bot.applicationId) };
  });
}
