import { useSearchParams } from "react-router";

export function LoginPage() {
  const [params] = useSearchParams();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6 text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-16 w-16" />
        <div>
          <h1 className="text-2xl font-semibold">BotPanel</h1>
          <p className="mt-1 text-sm text-zinc-400">Discord-Bots erstellen, konfigurieren und betreiben</p>
        </div>
        {params.get("error") && <p className="rounded-md bg-red-500/10 p-2 text-sm text-red-400">Anmeldung fehlgeschlagen. Bitte erneut versuchen.</p>}
        <a href="/api/auth/login" className="btn-primary w-full">
          Mit Discord anmelden
        </a>
      </div>
    </div>
  );
}
