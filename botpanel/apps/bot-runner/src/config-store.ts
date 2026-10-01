import type { PrismaClient } from "@botpanel/db";
import { isModuleKey, safeModuleConfig, type ModuleConfigs, type ModuleKey } from "@botpanel/shared";

/** Hält alle Modul-Konfigurationen eines Bots im Speicher; wird bei Änderungen aus der DB nachgeladen. */
export class ConfigStore {
  private configs = new Map<string, unknown>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly botId: string,
  ) {}

  private static key(guildId: string, module: ModuleKey) {
    return `${guildId}:${module}`;
  }

  async loadAll(): Promise<void> {
    const rows = await this.prisma.moduleConfig.findMany({ where: { botId: this.botId } });
    this.configs.clear();
    for (const row of rows) {
      if (isModuleKey(row.module)) this.configs.set(ConfigStore.key(row.guildId, row.module), row.config);
    }
  }

  async reload(guildId: string, module: ModuleKey): Promise<void> {
    const row = await this.prisma.moduleConfig.findUnique({
      where: { botId_guildId_module: { botId: this.botId, guildId, module } },
    });
    if (row) this.configs.set(ConfigStore.key(guildId, module), row.config);
    else this.configs.delete(ConfigStore.key(guildId, module));
  }

  /** Liefert immer eine gültige Konfiguration (Standardwerte, falls nichts gespeichert ist). */
  get<K extends ModuleKey>(guildId: string, module: K): ModuleConfigs[K] {
    return safeModuleConfig(module, this.configs.get(ConfigStore.key(guildId, module)));
  }
}
