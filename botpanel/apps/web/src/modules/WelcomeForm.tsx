import { renderTemplate, type ChannelDto, type RoleDto, type WelcomeConfig } from "@botpanel/shared";
import { useState, type FormEvent } from "react";
import { ChannelSelect, Field, RoleMultiSelect, Toggle } from "../components/Form";
import { useSaveModule } from "./useSaveModule";

const placeholderHint = "Platzhalter: {user} (Erwähnung), {username}, {server}, {memberCount}";

export function WelcomeForm(props: {
  botId: string;
  guildId: string;
  initial: WelcomeConfig;
  channels: ChannelDto[];
  roles: RoleDto[];
}) {
  const [cfg, setCfg] = useState(props.initial);
  const save = useSaveModule(props.botId, props.guildId, "welcome");
  const set = <K extends keyof WelcomeConfig>(key: K, value: WelcomeConfig[K]) => {
    save.reset();
    setCfg((c) => ({ ...c, [key]: value }));
  };

  const preview = renderTemplate(cfg.message, { user: "@NeuesMitglied", username: "NeuesMitglied", server: "Dein Server", memberCount: 128 });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(cfg);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Toggle checked={cfg.enabled} onChange={(v) => set("enabled", v)} label="Modul aktiv" />

      <fieldset className="space-y-4" disabled={!cfg.enabled}>
        <h3 className="font-medium">Begrüßung</h3>
        <Field label="Kanal">
          <ChannelSelect channels={props.channels} value={cfg.channelId} onChange={(v) => set("channelId", v)} />
        </Field>
        <Field label="Nachricht" hint={placeholderHint}>
          <textarea className="input min-h-24" value={cfg.message} maxLength={2000} onChange={(e) => set("message", e.target.value)} />
        </Field>
        <Toggle checked={cfg.useEmbed} onChange={(v) => set("useEmbed", v)} label="Als Embed (Karte) senden" />
        {cfg.useEmbed && (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Embed-Titel">
              <input className="input" value={cfg.embedTitle} maxLength={256} onChange={(e) => set("embedTitle", e.target.value)} />
            </Field>
            <Field label="Farbe">
              <input type="color" className="h-10 w-16 cursor-pointer rounded-md border border-zinc-700 bg-zinc-900" value={cfg.embedColor} onChange={(e) => set("embedColor", e.target.value)} />
            </Field>
          </div>
        )}

        <div className="rounded-md border-l-4 bg-zinc-950 p-3 text-sm" style={{ borderColor: cfg.useEmbed ? cfg.embedColor : "transparent" }}>
          <div className="mb-1 text-xs uppercase text-zinc-500">Vorschau</div>
          {cfg.useEmbed && <div className="font-semibold">{cfg.embedTitle}</div>}
          <div className="whitespace-pre-wrap text-zinc-300">{preview}</div>
        </div>

        <Field label="Autorollen" hint="Neue Mitglieder bekommen diese Rollen automatisch. Die Bot-Rolle muss über diesen Rollen stehen.">
          <RoleMultiSelect roles={props.roles} value={cfg.autoRoleIds} onChange={(v) => set("autoRoleIds", v)} />
        </Field>

        <h3 className="pt-2 font-medium">Abschied</h3>
        <Toggle checked={cfg.leaveEnabled} onChange={(v) => set("leaveEnabled", v)} label="Abschiedsnachricht senden" />
        {cfg.leaveEnabled && (
          <>
            <Field label="Kanal">
              <ChannelSelect channels={props.channels} value={cfg.leaveChannelId} onChange={(v) => set("leaveChannelId", v)} />
            </Field>
            <Field label="Nachricht" hint={placeholderHint}>
              <textarea className="input min-h-20" value={cfg.leaveMessage} maxLength={2000} onChange={(e) => set("leaveMessage", e.target.value)} />
            </Field>
          </>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? "Speichere …" : "Speichern"}
        </button>
        {save.isSuccess && <span className="text-sm text-emerald-400">✓ Gespeichert. Der Bot übernimmt es sofort.</span>}
        {save.error && <span className="text-sm text-red-400">{save.error.message}</span>}
      </div>
    </form>
  );
}
