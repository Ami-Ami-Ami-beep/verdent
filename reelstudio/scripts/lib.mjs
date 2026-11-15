import fs from "node:fs";
import path from "node:path";

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export function reelDir(name) {
  if (!name) {
    console.error("Bitte Reel-Namen angeben, z. B.: npm run timing -- demo");
    process.exit(1);
  }
  const dir = path.join(root, "reels", name);
  if (!fs.existsSync(dir)) {
    console.error(`Ordner nicht gefunden: ${dir}`);
    process.exit(1);
  }
  return dir;
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

/** Schreibt `words` in reel.json (legt die Datei an, falls sie fehlt). */
export function saveWords(dir, words) {
  const file = path.join(dir, "reel.json");
  const reel = fs.existsSync(file) ? readJson(file) : { title: path.basename(dir), scenes: [] };
  reel.words = words;
  writeJson(file, reel);
  return file;
}
