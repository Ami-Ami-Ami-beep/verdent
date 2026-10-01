import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { Field } from "../components/Form";
import { StatusBadge } from "../components/StatusBadge";
import { useBots } from "../hooks";

export function BotsPage() {
  const bots = useBots();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Deine Bots</h1>
        <button className="btn-primary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Abbrechen" : "+ Bot hinzufügen"}
        </button>
      </div>

      {showAdd && <AddBotForm onDone={() => setShowAdd(false)} />}

      {bots.isLoading && <p className="text-zinc-400">Lade …</p>}
      {bots.data?.length === 0 && !showAdd && (
        <div className="card text-center text-zinc-400">Noch keine Bots. Füge deinen ersten Bot hinzu!</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bots.data?.map((bot) => (
          <Link key={bot.id} to={`/bots/${bot.id}`} className="card flex items-center gap-4 transition hover:border-blurple">
            {bot.avatarUrl ? (
              <img src={bot.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blurple text-lg font-bold">
                {bot.name[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{bot.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={bot.status} />
                {bot.partnerBotId && <span className="text-xs text-zinc-400">🛡️ Partner</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AddBotForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => api.post("/api/bots", { token, name: name || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-400">
        <li>
          Öffne das{" "}
          <a className="text-blurple underline" href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">
            Discord Developer Portal
          </a>{" "}
          und erstelle eine neue Application.
        </li>
        <li>Unter „Bot“: <b>Server Members Intent</b> und <b>Message Content Intent</b> aktivieren.</li>
        <li>Auf „Reset Token“ klicken und den Token hier einfügen. Er wird verschlüsselt gespeichert.</li>
      </ol>
      <Field label="Bot-Token">
        <input className="input font-mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" />
      </Field>
      <Field label="Name (optional)" hint="Leer lassen = Name des Bots aus Discord">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
      </Field>
      {add.error && <p className="text-sm text-red-400">{add.error.message}</p>}
      <button className="btn-primary" disabled={add.isPending || token.length < 50}>
        {add.isPending ? "Prüfe Token …" : "Bot hinzufügen"}
      </button>
    </form>
  );
}
