import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { ZodError } from "zod";
import { prisma, redis } from "./context.js";
import { DiscordApiError } from "./discord.js";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { botRoutes } from "./routes/bots.js";
import { guildRoutes } from "./routes/guilds.js";

const app = Fastify({ logger: { level: "info" }, trustProxy: true });

// Nur JSON annehmen: verhindert, dass fremde Seiten per einfachem Formular-POST Aktionen auslösen.
app.removeContentTypeParser("text/plain");

await app.register(cookie, { secret: env.SESSION_SECRET });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Ungültige Eingabe", issues: error.issues });
  }
  if (error instanceof DiscordApiError) {
    request.log.warn({ err: error }, "Discord-API-Fehler");
    const status = error.status === 403 || error.status === 404 ? error.status : 502;
    return reply.code(status).send({ error: "Fehler bei der Discord-API", detail: error.message });
  }
  const status = (error as { statusCode?: number }).statusCode;
  if (status && status < 500) return reply.code(status).send({ error: (error as Error).message });
  request.log.error(error);
  return reply.code(500).send({ error: "Interner Fehler" });
});

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  await redis.ping();
  return { ok: true };
});

await app.register(authRoutes);
await app.register(botRoutes);
await app.register(guildRoutes);

// Im Produktivbetrieb liefert die API auch die gebaute Website aus (gleiche Domain → Cookies funktionieren einfach).
const here = dirname(fileURLToPath(import.meta.url));
const webDist = env.WEB_DIST ?? resolve(here, "../../web/dist");
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((request, reply) => {
    // App-Routen wie /bots/123 → index.html (React übernimmt); fehlende Dateien wie /assets/x.js → echtes 404.
    const path = request.url.split("?")[0]!;
    const isAppRoute = request.method === "GET" && !path.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(path);
    if (isAppRoute) return reply.sendFile("index.html");
    return reply.code(404).send({ error: "Nicht gefunden" });
  });
  app.log.info(`Website wird ausgeliefert aus ${webDist}`);
}

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: env.API_PORT, host: env.API_HOST });
