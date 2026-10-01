import type { ModuleKey } from "./modules.js";

/** Redis-Pub/Sub-Kanal zwischen API und bot-runner. */
export const EVENTS_CHANNEL = "botpanel:events";
/** Redis-Hash: botId → JSON(BotRuntimeStatus), geschrieben vom bot-runner. */
export const STATUS_HASH = "botpanel:status";

export type BotEvent =
  | { type: "bot.start"; botId: string }
  | { type: "bot.stop"; botId: string }
  | { type: "bot.restart"; botId: string }
  | { type: "config.updated"; botId: string; guildId: string; module: ModuleKey };

export type BotRuntimeState = "stopped" | "starting" | "online" | "error";

export interface BotRuntimeStatus {
  state: BotRuntimeState;
  error?: string;
  guildCount?: number;
  ping?: number;
  updatedAt: string;
}
