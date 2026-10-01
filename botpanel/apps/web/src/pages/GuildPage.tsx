import { moduleInfo, moduleKeys, type ModuleKey } from "@botpanel/shared";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useChannels, useGuilds, useModules, useRoles } from "../hooks";
import { WelcomeForm } from "../modules/WelcomeForm";

/** Module, deren Formular schon fertig ist. Die übrigen folgen in Phase 2. */
const readyModules: ModuleKey[] = ["welcome"];

export function GuildPage() {
  const { botId = "", guildId = "" } = useParams();
  const [active, setActive] = useState<ModuleKey>("welcome");
  const guilds = useGuilds(botId);
  const modules = useModules(botId, guildId);
  const channels = useChannels(botId, guildId);
  const roles = useRoles(botId, guildId);
  const guild = guilds.data?.find((g) => g.id === guildId);

  const error = modules.error ?? channels.error ?? roles.error;
  const loading = modules.isLoading || channels.isLoading || roles.isLoading;

  return (
    <div className="space-y-6">
      <Link to={`/bots/${botId}`} className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Zurück zum Bot
      </Link>
      <h1 className="text-2xl font-semibold">{guild?.name ?? "Server"}</h1>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {moduleKeys.map((key) => {
            const enabled = modules.data?.[key].enabled;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  active === key ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {moduleInfo[key].name}
                {enabled && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Aktiv" />}
              </button>
            );
          })}
        </nav>

        <div className="card min-w-0">
          <h2 className="text-lg font-semibold">{moduleInfo[active].name}</h2>
          <p className="mb-5 text-sm text-zinc-400">{moduleInfo[active].description}</p>
          {loading && <p className="text-zinc-400">Lade …</p>}
          {error && <p className="text-red-400">{error.message}</p>}
          {modules.data && channels.data && roles.data && (
            <>
              {active === "welcome" && (
                <WelcomeForm
                  botId={botId}
                  guildId={guildId}
                  initial={modules.data.welcome}
                  channels={channels.data}
                  roles={roles.data}
                />
              )}
              {!readyModules.includes(active) && (
                <p className="rounded-md bg-zinc-800/60 p-4 text-sm text-zinc-400">Dieses Modul wird im nächsten Schritt (Phase 2) freigeschaltet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
