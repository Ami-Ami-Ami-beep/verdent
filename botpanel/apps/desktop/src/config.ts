import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface DesktopConfig {
  serverUrl: string | null;
}

const file = () => join(app.getPath("userData"), "config.json");

export function loadConfig(): DesktopConfig {
  try {
    const raw = JSON.parse(readFileSync(file(), "utf8")) as Partial<DesktopConfig>;
    return { serverUrl: typeof raw.serverUrl === "string" ? raw.serverUrl : null };
  } catch {
    return { serverUrl: null };
  }
}

export function saveConfig(config: DesktopConfig): void {
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), JSON.stringify(config, null, 2));
}

/** Prüft und normalisiert die eingegebene Adresse (nur http/https, ohne Pfad). */
export function normalizeServerUrl(input: string): string | null {
  try {
    const url = new URL(input.trim().includes("://") ? input.trim() : `https://${input.trim()}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
