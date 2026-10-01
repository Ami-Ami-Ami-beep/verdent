import { randomBytes } from "node:crypto";
import type { MeDto } from "@botpanel/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../context.js";
import { avatarUrl, exchangeCode, getOAuthUser } from "../discord.js";
import { env, isHttps } from "../env.js";
import { createSession, destroySession, requireAuth } from "../session.js";

const STATE_COOKIE = "bp_oauth_state";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/login", async (_request, reply) => {
    const state = randomBytes(16).toString("base64url");
    reply.setCookie(STATE_COOKIE, state, { path: "/", httpOnly: true, sameSite: "lax", secure: isHttps, maxAge: 600 });
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: env.DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds",
      state,
      prompt: "none",
    });
    return reply.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/api/auth/callback", async (request, reply) => {
    const { code, state, error } = request.query;
    const expected = request.cookies[STATE_COOKIE];
    reply.clearCookie(STATE_COOKIE, { path: "/" });
    if (error || !code || !state || state !== expected) {
      return reply.redirect(`${env.PUBLIC_URL}/login?error=oauth`);
    }

    const token = await exchangeCode(code, {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      redirectUri: env.DISCORD_REDIRECT_URI,
    });
    const du = await getOAuthUser(token.access_token);
    const user = await prisma.user.upsert({
      where: { discordId: du.id },
      create: { discordId: du.id, username: du.global_name ?? du.username, avatar: du.avatar },
      update: { username: du.global_name ?? du.username, avatar: du.avatar },
    });
    await createSession(reply, user.id, token.access_token, token.expires_in);
    return reply.redirect(`${env.PUBLIC_URL}/`);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await destroySession(request, reply);
    return { ok: true };
  });

  app.get("/api/me", { preHandler: requireAuth }, async (request): Promise<MeDto> => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });
    return { id: user.id, discordId: user.discordId, username: user.username, avatarUrl: avatarUrl(user.discordId, user.avatar) };
  });
}
