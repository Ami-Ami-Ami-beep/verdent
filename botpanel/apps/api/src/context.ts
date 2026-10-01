import { createPrisma } from "@botpanel/db";
import { EVENTS_CHANNEL, type BotEvent } from "@botpanel/shared";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const prisma = createPrisma();
export const redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });

export async function publish(event: BotEvent): Promise<void> {
  await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
}
