import type { ModuleConfigs, ModuleKey } from "@botpanel/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export function useSaveModule<K extends ModuleKey>(botId: string, guildId: string, module: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ModuleConfigs[K]) =>
      api.put<ModuleConfigs[K]>(`/api/bots/${botId}/guilds/${guildId}/modules/${module}`, config),
    onSuccess: (saved) => {
      qc.setQueryData<ModuleConfigs>(["modules", botId, guildId], (old) => (old ? { ...old, [module]: saved } : old));
    },
  });
}
