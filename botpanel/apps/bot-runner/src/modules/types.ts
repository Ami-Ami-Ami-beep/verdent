import type { ModuleKey } from "@botpanel/shared";
import type { Client } from "discord.js";
import type { ConfigStore } from "../config-store.js";
import type { Logger } from "../lib/logger.js";

export interface ModuleContext {
  client: Client;
  config: ConfigStore;
  log: Logger;
  botId: string;
  /** Discord-ID des Partner-Bots (gegenseitiger Schutz), falls gesetzt. */
  partnerApplicationId: string | null;
  /** Discord-IDs aller Bots dieser Plattform (werden vom Bot-Schutz nie gekickt). */
  platformBotIds: ReadonlySet<string>;
}

export interface BotModule {
  key: ModuleKey;
  /** Hängt Event-Handler an den Client. Wird einmal beim Start des Bots aufgerufen. */
  register(ctx: ModuleContext): void;
  /** Optional: wird aufgerufen, wenn sich die Konfiguration eines Servers geändert hat. */
  onConfigUpdated?(ctx: ModuleContext, guildId: string): Promise<void>;
}
