import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { useBots, useGuilds } from "../hooks";

export function BotPage() {
  const { botId = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const bots = useBots();
  const guilds = useGuilds(botId);
  const bot = bots.data?.find((b) => b.id === botId);

  const action = useMutation({
    mutationFn: (a: "start" | "stop") => api.post(`/api/bots/${botId}/${a}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
  });
  const setPartner = useMutation({
    mutationFn: (partnerBotId: string | null) => api.patch(`/api/bots/${botId}`, { partnerBotId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/bots/${botId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      navigate("/");
    },
  });
  const invite = async () => {
    const { url } = await api.get<{ url: string }>(`/api/bots/${botId}/invite`);
    window.open(url, "_blank", "noopener");
  };

  if (bots.isLoading) return <p className="text-zinc-400">Lade …</p>;
  if (!bot) return <p className="text-zinc-400">Bot nicht gefunden.</p>;

  const otherBots = bots.data?.filter((b) => b.id !== bot.id) ?? [];
  const running = bot.status.state === "online" || bot.status.state === "starting";

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Alle Bots
      </Link>

      <div className="card flex flex-wrap items-center gap-4">
        {bot.avatarUrl && <img src={bot.avatarUrl} alt="" className="h-16 w-16 rounded-full" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{bot.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <StatusBadge status={bot.status} />
            {bot.status.guildCount !== undefined && <span>{bot.status.guildCount} Server</span>}
            <span className="font-mono text-xs">ID {bot.applicationId}</span>
          </div>
          {bot.status.state === "error" && <p className="mt-2 text-sm text-red-400">{bot.status.error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {bot.enabled || running ? (
            <button className="btn-secondary" onClick={() => action.mutate("stop")} disabled={action.isPending}>
              ■ Stoppen
            </button>
          ) : (
            <button className="btn-primary" onClick={() => action.mutate("start")} disabled={action.isPending}>
              ▶ Starten
            </button>
          )}
          <button className="btn-secondary" onClick={invite}>
            Zu Server einladen
          </button>
        </div>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">🛡️ Partner-Bot (gegenseitiger Schutz)</h2>
        <p className="text-sm text-zinc-400">
          Zwei Bots auf demselben Server überwachen sich gegenseitig. Wird einer gekickt oder gebannt, bestraft der andere den
          Täter sofort und schickt dem Owner den Einladungslink. Hinweis: Discord erlaubt es Bots nicht, sich selbst wieder
          einzuladen. Das muss ein Admin per Klick machen.
        </p>
        <select
          className="input max-w-sm"
          value={bot.partnerBotId ?? ""}
          onChange={(e) => setPartner.mutate(e.target.value || null)}
          disabled={setPartner.isPending}
        >
          <option value="">— kein Partner —</option>
          {otherBots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {setPartner.error && <p className="text-sm text-red-400">{setPartner.error.message}</p>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Server</h2>
          <button className="text-sm text-zinc-400 hover:text-zinc-200" onClick={() => api.get(`/api/bots/${botId}/guilds?refresh=1`).then((data) => qc.setQueryData(["guilds", botId], data))}>
            ↻ Aktualisieren
          </button>
        </div>
        {guilds.isLoading && <p className="text-zinc-400">Lade Server …</p>}
        {guilds.error && <p className="text-red-400">{guilds.error.message}</p>}
        {guilds.data?.length === 0 && (
          <div className="card text-sm text-zinc-400">
            Der Bot ist auf keinem Server, auf dem du „Server verwalten“ hast. Klicke oben auf „Zu Server einladen“.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guilds.data?.map((g) => (
            <Link key={g.id} to={`/bots/${botId}/guilds/${g.id}`} className="card flex items-center gap-3 transition hover:border-blurple">
              {g.iconUrl ? (
                <img src={g.iconUrl} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700">{g.name[0]}</div>
              )}
              <span className="truncate font-medium">{g.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card border-red-900/50">
        <h2 className="font-semibold text-red-400">Gefahrenzone</h2>
        <p className="mt-1 text-sm text-zinc-400">Entfernt den Bot und alle Einstellungen aus dem Panel. Der Discord-Bot selbst bleibt bestehen.</p>
        <button
          className="btn-danger mt-3"
          onClick={() => confirm(`„${bot.name}“ wirklich löschen?`) && remove.mutate()}
          disabled={remove.isPending}
        >
          Bot löschen
        </button>
      </section>
    </div>
  );
}
