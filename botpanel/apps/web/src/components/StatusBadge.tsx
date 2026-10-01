import type { BotRuntimeStatus } from "@botpanel/shared";

const styles: Record<BotRuntimeStatus["state"], [string, string]> = {
  online: ["bg-emerald-500", "Online"],
  starting: ["bg-amber-400", "Startet …"],
  stopped: ["bg-zinc-500", "Gestoppt"],
  error: ["bg-red-500", "Fehler"],
};

export function StatusBadge({ status }: { status: BotRuntimeStatus }) {
  const [color, label] = styles[status.state];
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-2.5 py-1 text-xs" title={status.error}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
      {status.state === "online" && status.ping ? <span className="text-zinc-400">{status.ping} ms</span> : null}
    </span>
  );
}
