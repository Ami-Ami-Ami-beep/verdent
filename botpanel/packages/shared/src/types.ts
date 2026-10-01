import type { BotRuntimeStatus } from "./events.js";

/** Bot, wie ihn die API an die Oberfläche liefert (niemals mit Token). */
export interface BotDto {
  id: string;
  name: string;
  applicationId: string;
  avatarUrl: string | null;
  enabled: boolean;
  partnerBotId: string | null;
  createdAt: string;
  status: BotRuntimeStatus;
}

export interface GuildDto {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface ChannelDto {
  id: string;
  name: string;
  /** 0 = Text, 2 = Sprache, 4 = Kategorie, 5 = Ankündigung */
  type: number;
  parentId: string | null;
}

export interface RoleDto {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  position: number;
}

export interface MeDto {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
}
