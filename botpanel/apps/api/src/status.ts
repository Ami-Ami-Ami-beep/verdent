import { STATUS_HASH, type BotRuntimeStatus } from "@botpanel/shared";
import { redis } from "./context.js";

const STOPPED: BotRuntimeStatus = { state: "stopped", updatedAt: new Date(0).toISOString() };

export async function getStatuses(botIds: string[]): Promise<Map<string, BotRuntimeStatus>> {
  const result = new Map<string, BotRuntimeStatus>();
  if (botIds.length === 0) return result;
  const raw = await redis.hmget(STATUS_HASH, ...botIds);
  botIds.forEach((id, i) => {
    const value = raw[i];
    result.set(id, value ? (JSON.parse(value) as BotRuntimeStatus) : STOPPED);
  });
  return result;
}
