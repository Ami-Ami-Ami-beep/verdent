// Schätzt Wort-Zeitstempel aus script.txt – zum Vorschauen, bevor es echte Audio gibt.
// Nutzung: npm run timing -- <reel>   (liest reels/<reel>/script.txt)
import fs from "node:fs";
import path from "node:path";
import { reelDir, saveWords } from "./lib.mjs";

const dir = reelDir(process.argv[2]);
const text = fs.readFileSync(path.join(dir, "script.txt"), "utf8").trim();
const CHARS_PER_SEC = 15; // ~ normales Sprechtempo auf Deutsch

let t = 0.3;
const words = text.split(/\s+/).filter(Boolean).map((w) => {
  const dur = Math.max(0.18, w.replace(/[^\p{L}\p{N}]/gu, "").length / CHARS_PER_SEC + 0.06);
  const word = { text: w, start: +t.toFixed(3), end: +(t + dur).toFixed(3) };
  t += dur + (/[.!?]$/.test(w) ? 0.45 : /[,:;]$/.test(w) ? 0.2 : 0.04);
  return word;
});

const file = saveWords(dir, words);
console.log(`${words.length} Wörter, ~${t.toFixed(1)} s geschätzt → ${path.relative(process.cwd(), file)}`);
