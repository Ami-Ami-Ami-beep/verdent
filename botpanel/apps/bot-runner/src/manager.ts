import type { PrismaClient } from "@botpanel/db";
import { STATUS_HASH, type BotEvent, type BotRuntimeStatus } from "@botpanel/shared";
import { decryptSecret } from "@botpanel/shared/crypto";
import type { Redis } from "ioredis";
import { env } from "./env.js";
import { BotInstance } from "./instance.js";
import type { Logger } from "./lib/logger.js";

/** Startet/stoppt Bot-Instanzen anhand der Datenbank und der Events aus der API. */
export class BotManager {
  private instances = new Map<string, BotInstance>();
  /** Wird an alle Instanzen gereicht und hier aktuell gehalten. */
  private platformBotIds = new Set<string>();
  /** Verhindert, dass Start/Stopp desselben Bots sich überholen. */
  private queues = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly log: Logger,
  ) {}

  private serialize(botId: string, task: () => Promise<void>): Promise<void> {
    const prev = this.queues.get(botId) ?? Promise.resolve();
    const next = prev.then(task).catch((err: unknown) => this.log.error(`Aufgabe für Bot ${botId} fehlgeschlagen`, err));
    this.queues.set(botId, next);
    return next;
  }

  private async refreshPlatformBotIds() {
    const bots = await this.prisma.bot.findMany({ select: { applicationId: true } });
    this.platformBotIds.clear();
    for (const b of bots) this.platformBotIds.add(b.applicationId);
  }

  private writeStatus(botId: string, status: BotRuntimeStatus) {
    this.redis.hset(STATUS_HASH, botId, JSON.stringify(status)).catch((err: unknown) => {
      this.log.warn("Status konnte nicht gespeichert werden", err);
    });
  }

  async startAll(): Promise<void> {
    await this.refreshPlatformBotIds();
    const bots = await this.prisma.bot.findMany({ where: { enabled: true }, select: { id: true } });
    this.log.info(`${bots.length} aktivierte(r) Bot(s) werden gestartet`);
    await Promise.all(bots.map((b) => this.start(b.id)));
  }

  start(botId: string): Promise<void> {
    return this.serialize(botId, async () => {
      await this.stopNow(botId, false);
      const bot = await this.prisma.bot.findUnique({ where: { id: botId }, include: { partnerBot: true } });
      if (!bot) {
        await this.redis.hdel(STATUS_HASH, botId);
        return;
      }
      if (!bot.enabled) return;
      await this.refreshPlatformBotIds();
      const instance = new BotInstance({
        botId,
        token: decryptSecret(bot.tokenEnc, env.TOKEN_ENCRYPTION_KEY),
        partnerApplicationId: bot.partnerBot?.applicationId ?? null,
        platformBotIds: this.platformBotIds,
        prisma: this.prisma,
        log: this.log.child(bot.name),
        onStatus: (s) => this.writeStatus(botId, s),
      });
      this.instances.set(botId, instance);
      await instance.start();
    });
  }

  stop(botId: string): Promise<void> {
    return this.serialize(botId, () => this.stopNow(botId, true));
  }

  private async stopNow(botId: string, report: boolean) {
    const instance = this.instances.get(botId);
    this.instances.delete(botId);
    if (instance) await instance.stop(report);
    else if (report) this.writeStatus(botId, { state: "stopped", updatedAt: new Date().toISOString() });
  }

  async handle(event: BotEvent): Promise<void> {
    switch (event.type) {
      case "bot.start":
      case "bot.restart":
        return this.start(event.botId);
      case "bot.stop":
        return this.stop(event.botId);
      case "config.updated": {
        const instance = this.instances.get(event.botId);
        if (instance) await this.serialize(event.botId, () => instance.onConfigUpdated(event.guildId, event.module));
        return;
      }
    }
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.instances.keys()].map((id) => this.stop(id)));
  }
}
