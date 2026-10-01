import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@botpanel/shared/crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./context.js";
import { env, isHttps } from "./env.js";

export const SESSION_COOKIE = "bp_session";

export interface SessionUser {
  sessionId: string;
  userId: string;
  discordId: string;
  accessToken: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

/** In der DB liegt nur der Hash der Sitzungs-ID, nicht die ID selbst. */
const hashId = (id: string) => createHash("sha256").update(id).digest("hex");

export async function createSession(reply: FastifyReply, userId: string, accessToken: string, expiresInSec: number) {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  await prisma.session.create({
    data: { id: hashId(id), userId, accessTokenEnc: encryptSecret(accessToken, env.TOKEN_ENCRYPTION_KEY), expiresAt },
  });
  reply.setCookie(SESSION_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    expires: expiresAt,
  });
}

export async function destroySession(request: FastifyRequest, reply: FastifyReply) {
  const id = request.cookies[SESSION_COOKIE];
  if (id) await prisma.session.deleteMany({ where: { id: hashId(id) } });
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** preHandler: lädt die Sitzung oder antwortet mit 401. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const id = request.cookies[SESSION_COOKIE];
  if (!id) return reply.code(401).send({ error: "Nicht angemeldet" });
  const session = await prisma.session.findUnique({ where: { id: hashId(id) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(401).send({ error: "Sitzung abgelaufen" });
  }
  request.user = {
    sessionId: session.id,
    userId: session.userId,
    discordId: session.user.discordId,
    accessToken: decryptSecret(session.accessTokenEnc, env.TOKEN_ENCRYPTION_KEY),
  };
}
