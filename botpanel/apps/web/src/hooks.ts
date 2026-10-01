import type { BotDto, ChannelDto, GuildDto, MeDto, ModuleConfigs, RoleDto } from "@botpanel/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api.get<MeDto>("/api/me") });

// Status alle 5 s aktualisieren, damit Start/Stopp sichtbar wird.
export const useBots = () =>
  useQuery({ queryKey: ["bots"], queryFn: () => api.get<BotDto[]>("/api/bots"), refetchInterval: 5000 });

export const useGuilds = (botId: string) =>
  useQuery({ queryKey: ["guilds", botId], queryFn: () => api.get<GuildDto[]>(`/api/bots/${botId}/guilds`) });

export const useChannels = (botId: string, guildId: string) =>
  useQuery({
    queryKey: ["channels", botId, guildId],
    queryFn: () => api.get<ChannelDto[]>(`/api/bots/${botId}/guilds/${guildId}/channels`),
  });

export const useRoles = (botId: string, guildId: string) =>
  useQuery({
    queryKey: ["roles", botId, guildId],
    queryFn: () => api.get<RoleDto[]>(`/api/bots/${botId}/guilds/${guildId}/roles`),
  });

export const useModules = (botId: string, guildId: string) =>
  useQuery({
    queryKey: ["modules", botId, guildId],
    queryFn: () => api.get<ModuleConfigs>(`/api/bots/${botId}/guilds/${guildId}/modules`),
  });
