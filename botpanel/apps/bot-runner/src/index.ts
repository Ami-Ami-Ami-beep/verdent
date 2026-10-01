import { createPrisma } from "@botpanel/db";
import { EVENTS_CHANNEL, type BotEvent } from "@botpanel/shared";
import { Redis } from "ioredis";
import { env } from "./env.js";
import { createLogger } from "./lib/logger.js";
import { BotManager } from "./manager.js";

const log = createLogger("runner");
const prisma = createPrisma();
const redis = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);
const manager = new BotManager(prisma, redis, log);

await subscriber.subscribe(EVENTS_CHANNEL);
subscriber.on("message", (_channel, message) => {
  let event: BotEvent;
  try {
    event = JSON.parse(message) as BotEvent;
  } catch {
    log.warn(`Ungültiges Event ignoriert: ${message.slice(0, 100)}`);
    return;
  }
  void manager.handle(event);
});

await manager.startAll();
log.info("bot-runner bereit");

const shutdown = async () => {
  log.info("Fahre herunter …");
  await manager.stopAll();
  subscriber.disconnect();
  redis.disconnect();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
