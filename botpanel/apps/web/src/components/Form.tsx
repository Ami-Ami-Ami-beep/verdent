import type { ChannelDto, RoleDto } from "@botpanel/shared";
import type { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-zinc-200">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-sm"
    >
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-blurple" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-5.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

/** Text- und Ankündigungskanäle, gruppiert nach Kategorie. */
export function ChannelSelect({
  channels,
  value,
  onChange,
}: {
  channels: ChannelDto[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const categories = channels.filter((c) => c.type === 4);
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);
  const groups = [
    { id: null as string | null, name: "Ohne Kategorie" },
    ...categories.map((c) => ({ id: c.id as string | null, name: c.name })),
  ];
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— kein Kanal —</option>
      {groups.map((g) => {
        const items = textChannels.filter((c) => c.parentId === g.id);
        if (items.length === 0) return null;
        return (
          <optgroup key={g.id ?? "none"} label={g.name}>
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

export function RoleMultiSelect({
  roles,
  value,
  onChange,
}: {
  roles: RoleDto[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const selectable = roles.filter((r) => !r.managed);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 p-2">
      {selectable.length === 0 && <span className="text-xs text-zinc-500">Keine Rollen vorhanden</span>}
      {selectable.map((r) => {
        const active = value.includes(r.id);
        const color = r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#a1a1aa";
        return (
          <button
            type="button"
            key={r.id}
            onClick={() => toggle(r.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              active ? "border-blurple bg-blurple/20" : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            <span style={{ color }}>●</span> {r.name}
          </button>
        );
      })}
    </div>
  );
}
