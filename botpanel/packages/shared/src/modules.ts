import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/, "Ungültige Discord-ID");
const optionalSnowflake = snowflake.nullable().default(null);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe als #RRGGBB");

export const punishmentSchema = z.enum(["none", "removeRoles", "timeout", "kick", "ban"]);
export type Punishment = z.infer<typeof punishmentSchema>;

/** Willkommens- und Abschiedsnachrichten. Platzhalter: {user} {username} {server} {memberCount} */
export const welcomeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  channelId: optionalSnowflake,
  message: z.string().max(2000).default("Willkommen {user} auf **{server}**! Du bist Mitglied Nr. {memberCount}."),
  useEmbed: z.boolean().default(true),
  embedTitle: z.string().max(256).default("Willkommen!"),
  embedColor: hexColor.default("#5865F2"),
  autoRoleIds: z.array(snowflake).max(10).default([]),
  leaveEnabled: z.boolean().default(false),
  leaveChannelId: optionalSnowflake,
  leaveMessage: z.string().max(2000).default("**{username}** hat den Server verlassen."),
});

export const ticketsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  panelChannelId: optionalSnowflake,
  categoryId: optionalSnowflake,
  supportRoleIds: z.array(snowflake).max(10).default([]),
  logChannelId: optionalSnowflake,
  panelTitle: z.string().max(256).default("Support-Ticket"),
  panelDescription: z.string().max(2000).default("Klicke auf den Button, um ein Ticket zu öffnen."),
  topics: z
    .array(z.object({ label: z.string().min(1).max(80), description: z.string().max(100).default("") }))
    .max(25)
    .default([]),
  maxOpenPerUser: z.number().int().min(1).max(10).default(1),
});

export const applicationsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  panelChannelId: optionalSnowflake,
  reviewChannelId: optionalSnowflake,
  acceptRoleIds: z.array(snowflake).max(10).default([]),
  title: z.string().max(45).default("Bewerbung"),
  questions: z
    .array(z.object({ label: z.string().min(1).max(45), long: z.boolean().default(false), required: z.boolean().default(true) }))
    .max(5) // Discord-Modals erlauben max. 5 Eingabefelder
    .default([{ label: "Warum möchtest du ins Team?", long: true, required: true }]),
});

export const selfrolesConfigSchema = z.object({
  enabled: z.boolean().default(false),
  menus: z
    .array(
      z.object({
        channelId: snowflake,
        title: z.string().max(256).default("Wähle deine Rollen"),
        placeholder: z.string().max(150).default("Rollen auswählen …"),
        maxValues: z.number().int().min(1).max(25).default(25),
        options: z
          .array(z.object({ roleId: snowflake, label: z.string().min(1).max(100), emoji: z.string().max(64).optional() }))
          .min(1)
          .max(25),
      }),
    )
    .max(10)
    .default([]),
});

export const antispamConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxMessages: z.number().int().min(2).max(50).default(6),
  intervalSeconds: z.number().int().min(1).max(60).default(5),
  maxDuplicates: z.number().int().min(2).max(20).default(3),
  maxMentions: z.number().int().min(1).max(50).default(5),
  blockInvites: z.boolean().default(true),
  blockLinks: z.boolean().default(false),
  allowedDomains: z.array(z.string().max(253)).max(50).default([]),
  ignoredRoleIds: z.array(snowflake).max(25).default([]),
  ignoredChannelIds: z.array(snowflake).max(50).default([]),
  punishment: punishmentSchema.default("timeout"),
  timeoutMinutes: z.number().int().min(1).max(40320).default(10),
  raidProtection: z.boolean().default(true),
  raidJoins: z.number().int().min(3).max(100).default(10),
  raidSeconds: z.number().int().min(5).max(300).default(15),
  logChannelId: optionalSnowflake,
});

export const securityConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Nur diese Bots dürfen auf dem Server sein (zusätzlich zu den eigenen Plattform-Bots). */
  botWhitelist: z.array(snowflake).max(50).default([]),
  /** Diese Nutzer werden von den Schutzregeln ausgenommen (z. B. Co-Owner). */
  trustedUserIds: z.array(snowflake).max(25).default([]),
  blockForeignBots: z.boolean().default(true),
  protectPartnerBot: z.boolean().default(true),
  punishment: punishmentSchema.default("removeRoles"),
  /** Massenaktionen: mehr als `limit` Aktionen in `seconds` Sekunden lösen eine Strafe aus. */
  nukeLimits: z
    .object({
      channelDelete: z.number().int().min(1).max(50).default(3),
      roleDelete: z.number().int().min(1).max(50).default(3),
      ban: z.number().int().min(1).max(50).default(3),
      kick: z.number().int().min(1).max(50).default(5),
      seconds: z.number().int().min(5).max(600).default(30),
    })
    .default({ channelDelete: 3, roleDelete: 3, ban: 3, kick: 5, seconds: 30 }),
  alertChannelId: optionalSnowflake,
});

export const moduleSchemas = {
  welcome: welcomeConfigSchema,
  tickets: ticketsConfigSchema,
  applications: applicationsConfigSchema,
  selfroles: selfrolesConfigSchema,
  antispam: antispamConfigSchema,
  security: securityConfigSchema,
} as const;

export type ModuleKey = keyof typeof moduleSchemas;
export type ModuleConfigs = { [K in ModuleKey]: z.infer<(typeof moduleSchemas)[K]> };
export type WelcomeConfig = ModuleConfigs["welcome"];
export type TicketsConfig = ModuleConfigs["tickets"];
export type ApplicationsConfig = ModuleConfigs["applications"];
export type SelfrolesConfig = ModuleConfigs["selfroles"];
export type AntispamConfig = ModuleConfigs["antispam"];
export type SecurityConfig = ModuleConfigs["security"];

export const moduleKeys = Object.keys(moduleSchemas) as ModuleKey[];

export const moduleInfo: Record<ModuleKey, { name: string; description: string }> = {
  welcome: { name: "Willkommen", description: "Begrüßungs- und Abschiedsnachrichten, Autorollen" },
  tickets: { name: "Tickets", description: "Support-Tickets mit privaten Kanälen" },
  applications: { name: "Bewerbungen", description: "Bewerbungsformulare mit Annehmen/Ablehnen" },
  selfroles: { name: "Dropdown-Rollen", description: "Rollenauswahl über Dropdown-Menüs" },
  antispam: { name: "Spam-Schutz", description: "Spam-, Link- und Raid-Schutz" },
  security: { name: "Sicherheit", description: "Anti-Nuke, Bot-Whitelist, Partner-Bot-Schutz" },
};

export function isModuleKey(value: string): value is ModuleKey {
  return Object.hasOwn(moduleSchemas, value);
}

/** Validiert eine Konfiguration und füllt fehlende Felder mit Standardwerten. */
export function parseModuleConfig<K extends ModuleKey>(key: K, raw: unknown): ModuleConfigs[K] {
  return moduleSchemas[key].parse(raw ?? {}) as ModuleConfigs[K];
}

/** Wie parseModuleConfig, wirft aber nicht: ungültige gespeicherte Daten fallen auf Standardwerte zurück. */
export function safeModuleConfig<K extends ModuleKey>(key: K, raw: unknown): ModuleConfigs[K] {
  const result = moduleSchemas[key].safeParse(raw ?? {});
  return (result.success ? result.data : moduleSchemas[key].parse({})) as ModuleConfigs[K];
}

export function defaultModuleConfig<K extends ModuleKey>(key: K): ModuleConfigs[K] {
  return parseModuleConfig(key, {});
}
