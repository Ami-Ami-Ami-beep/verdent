import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, Outlet } from "react-router";
import { api, ApiError } from "../api";
import { useMe } from "../hooks";

export function Layout() {
  const me = useMe();
  const qc = useQueryClient();

  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;
  if (me.isLoading) return <div className="p-10 text-zinc-400">Lade …</div>;
  if (me.error) return <div className="p-10 text-red-400">Server nicht erreichbar: {me.error.message}</div>;

  const logout = async () => {
    await api.post("/api/auth/logout");
    qc.clear();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            BotPanel
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {me.data?.avatarUrl && <img src={me.data.avatarUrl} alt="" className="h-7 w-7 rounded-full" />}
            <span className="hidden sm:inline">{me.data?.username}</span>
            <button className="btn-secondary px-3 py-1" onClick={logout}>
              Abmelden
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
