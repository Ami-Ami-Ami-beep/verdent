import type { ChannelDto, GuildDto, RoleDto } from "@botpanel/shared";

const API = "https://discord.com/api/v10";

export class DiscordApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, auth: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: auth, "User-Agent": "BotPanel (https://github.com, 0.1)", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DiscordApiError(res.status, `Discord ${res.status} bei ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface RawUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
  bot?: boolean;
}
interface RawPartialGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}

export function avatarUrl(userId: string, avatar: string | null): string | null {
  return avatar ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128` : null;
}

function toGuildDto(g: RawPartialGuild): GuildDto {
  return { id: g.id, name: g.name, iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null };
}

// ---------- OAuth2 (Nutzer-Login) ----------

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCode(
  code: string,
  opts: { clientId: string; clientSecret: string; redirectUri: string },
): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: opts.redirectUri,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
  });
  if (!res.ok) throw new DiscordApiError(res.status, `OAuth-Code ungültig (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export function getOAuthUser(accessToken: string) {
  return request<RawUser>("/users/@me", `Bearer ${accessToken}`);
}

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

/** Server, auf denen der Nutzer „Server verwalten“ oder Admin hat. */
export async function getManageableGuilds(accessToken: string): Promise<GuildDto[]> {
  const guilds = await request<RawPartialGuild[]>("/users/@me/guilds", `Bearer ${accessToken}`);
  return guilds
    .filter((g) => {
      if (g.owner) return true;
      const perms = BigInt(g.permissions ?? "0");
      return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
    })
    .map(toGuildDto);
}

// ---------- Bot-Token ----------

/** Prüft einen Bot-Token und liefert den Bot-Nutzer. */
export async function getBotUser(token: string) {
  const user = await request<RawUser>("/users/@me", `Bot ${token}`);
  if (!user.bot) throw new DiscordApiError(400, "Der Token gehört nicht zu einem Bot");
  return user;
}

export async function getBotGuilds(token: string): Promise<GuildDto[]> {
  const guilds = await request<RawPartialGuild[]>("/users/@me/guilds", `Bot ${token}`);
  return guilds.map(toGuildDto);
}

export async function getGuildChannels(token: string, guildId: string): Promise<ChannelDto[]> {
  const channels = await request<{ id: string; name: string; type: number; parent_id: string | null; position: number }[]>(
    `/guilds/${guildId}/channels`,
    `Bot ${token}`,
  );
  return channels
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, type: c.type, parentId: c.parent_id }));
}

export async function getGuildRoles(token: string, guildId: string): Promise<RoleDto[]> {
  const roles = await request<{ id: string; name: string; color: number; managed: boolean; position: number }[]>(
    `/guilds/${guildId}/roles`,
    `Bot ${token}`,
  );
  return roles
    .filter((r) => r.id !== guildId) // @everyone
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color, managed: r.managed, position: r.position }));
}

/** Administrator-Rechte: nötig für Anti-Nuke (Audit-Log, Kicken, Rollen verwalten). */
export function botInviteUrl(applicationId: string): string {
  const params = new URLSearchParams({ client_id: applicationId, scope: "bot applications.commands", permissions: "8" });
  return `https://discord.com/oauth2/authorize?${params}`;
}
