import type { PrismaClient } from "@botpanel/db";
import type { BotRuntimeStatus, ModuleKey } from "@botpanel/shared";
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { ConfigStore } from "./config-store.js";
import type { Logger } from "./lib/logger.js";
import { modules } from "./modules/index.js";
import type { ModuleContext } from "./modules/types.js";

export interface InstanceOptions {
  botId: string;
  token: string;
  partnerApplicationId: string | null;
  platformBotIds: ReadonlySet<string>;
  prisma: PrismaClient;
  log: Logger;
  onStatus: (status: BotRuntimeStatus) => void;
}

/** Eine laufende Bot-Verbindung zu Discord. */
export class BotInstance {
  private client: Client | null = null;
  private ctx: ModuleContext | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  readonly config: ConfigStore;

  constructor(private readonly opts: InstanceOptions) {
    this.config = new ConfigStore(opts.prisma, opts.botId);
  }

  private status(state: BotRuntimeStatus["state"], error?: string) {
    this.opts.onStatus({
      state,
      error,
      guildCount: this.client?.guilds.cache.size,
      ping: this.client?.ws.ping && this.client.ws.ping > 0 ? this.client.ws.ping : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  async start(): Promise<void> {
    this.status("starting");
    await this.config.loadAll();

    const client = new Client({
      // GuildMembers und MessageContent sind „privilegiert“ und müssen im Developer-Portal aktiviert sein.
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.GuildMember, Partials.User],
    });
    this.client = client;
    this.ctx = {
      client,
      config: this.config,
      log: this.opts.log,
      botId: this.opts.botId,
      partnerApplicationId: this.opts.partnerApplicationId,
      platformBotIds: this.opts.platformBotIds,
    };
    for (const mod of modules) mod.register(this.ctx);

    client.once(Events.ClientReady, (c) => {
      this.opts.log.info(`Online als ${c.user.tag} auf ${c.guilds.cache.size} Server(n)`);
      this.status("online");
    });
    client.on(Events.ShardDisconnect, () => this.status("starting", "Verbindung getrennt, verbinde neu …"));
    client.on(Events.ShardResume, () => this.status("online"));
    client.on(Events.GuildCreate, () => this.status("online"));
    client.on(Events.GuildDelete, () => this.status("online"));
    client.on(Events.Error, (err) => this.opts.log.error("Client-Fehler", err));

    this.heartbeat = setInterval(() => {
      if (client.isReady()) this.status("online");
    }, 30_000);

    try {
      await client.login(this.opts.token);
    } catch (err) {
      const message = describeLoginError(err);
      this.opts.log.error(`Login fehlgeschlagen: ${message}`);
      await this.stop(false);
      this.status("error", message);
    }
  }

  async onConfigUpdated(guildId: string, module: ModuleKey): Promise<void> {
    await this.config.reload(guildId, module);
    const mod = modules.find((m) => m.key === module);
    if (mod?.onConfigUpdated && this.ctx) await mod.onConfigUpdated(this.ctx, guildId);
  }

  async stop(report = true): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    await this.client?.destroy();
    this.client = null;
    this.ctx = null;
    if (report) this.status("stopped");
  }
}

function describeLoginError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/disallowed intents/i.test(msg)) {
    return "Privileged Intents fehlen: Im Developer-Portal unter Bot „Server Members Intent“ und „Message Content Intent“ aktivieren.";
  }
  if (/invalid token|TokenInvalid/i.test(msg)) return "Ungültiger Token. Bitte den Bot mit neuem Token neu anlegen.";
  const status = (err as { status?: number }).status;
  if (status) return `Discord nicht erreichbar (HTTP ${status}): ${msg}`;
  return msg;
}
