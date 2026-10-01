/** Ersetzt {platzhalter} im Text. Unbekannte Platzhalter bleiben unverändert stehen. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}
