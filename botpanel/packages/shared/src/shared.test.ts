import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { defaultModuleConfig, isModuleKey, moduleKeys, parseModuleConfig, safeModuleConfig } from "./modules.js";
import { renderTemplate } from "./template.js";

describe("renderTemplate", () => {
  it("ersetzt bekannte Platzhalter", () => {
    expect(renderTemplate("Hi {user} auf {server} ({memberCount})", { user: "<@1>", server: "Test", memberCount: 42 })).toBe(
      "Hi <@1> auf Test (42)",
    );
  });
  it("lässt unbekannte Platzhalter stehen", () => {
    expect(renderTemplate("{foo} {user}", { user: "x" })).toBe("{foo} x");
  });
});

describe("Modul-Konfigurationen", () => {
  it("hat für jedes Modul gültige Standardwerte", () => {
    for (const key of moduleKeys) {
      expect(defaultModuleConfig(key).enabled).toBe(false);
    }
  });
  it("füllt fehlende Felder auf", () => {
    const cfg = parseModuleConfig("welcome", { enabled: true, channelId: "123456789012345678" });
    expect(cfg.enabled).toBe(true);
    expect(cfg.embedColor).toBe("#5865F2");
  });
  it("lehnt ungültige IDs ab", () => {
    expect(() => parseModuleConfig("welcome", { channelId: "abc" })).toThrow();
  });
  it("lehnt mehr als 5 Bewerbungsfragen ab (Discord-Limit)", () => {
    const questions = Array.from({ length: 6 }, (_, i) => ({ label: `Frage ${i}` }));
    expect(() => parseModuleConfig("applications", { questions })).toThrow();
  });
  it("safeModuleConfig fällt bei Müll auf Standardwerte zurück", () => {
    expect(safeModuleConfig("antispam", { maxMessages: "viele" })).toEqual(defaultModuleConfig("antispam"));
  });
  it("erkennt Modul-Schlüssel", () => {
    expect(isModuleKey("tickets")).toBe(true);
    expect(isModuleKey("toString")).toBe(false);
  });
});

describe("Token-Verschlüsselung", () => {
  const key = "a".repeat(64);
  it("verschlüsselt und entschlüsselt", () => {
    const enc = encryptSecret("geheimes.token", key);
    expect(enc).not.toContain("geheimes");
    expect(decryptSecret(enc, key)).toBe("geheimes.token");
  });
  it("erkennt manipulierte Daten", () => {
    const [iv, tag, data] = encryptSecret("token", key).split(".");
    const tampered = Buffer.from(data!, "base64");
    tampered[0] = tampered[0]! ^ 0xff;
    expect(() => decryptSecret([iv, tag, tampered.toString("base64")].join("."), key)).toThrow();
  });
  it("lehnt falsche Schlüssellänge ab", () => {
    expect(() => encryptSecret("x", "abcd")).toThrow(/32 Byte/);
  });
});
