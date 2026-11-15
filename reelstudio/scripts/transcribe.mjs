// Holt wortgenaue Zeitstempel mit Whisper (OpenAI API) aus der Sprachaufnahme.
// Nutzung: OPENAI_API_KEY=... npm run transcribe -- <reel> [audio-datei]
// Standard-Audio: reels/<reel>/voice.mp3 (oder .wav/.m4a)
import fs from "node:fs";
import path from "node:path";
import { reelDir, saveWords } from "./lib.mjs";

const dir = reelDir(process.argv[2]);
const audio =
  process.argv[3] ??
  ["voice.mp3", "voice.wav", "voice.m4a", "avatar.mp4"].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));

if (!audio || !fs.existsSync(audio)) {
  console.error("Keine Audio-Datei gefunden. Lege reels/<reel>/voice.mp3 ab oder gib den Pfad an.");
  process.exit(1);
}
const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY fehlt. Alternativ lokal: whisper.cpp / @remotion/install-whisper-cpp (siehe README).");
  process.exit(1);
}

const form = new FormData();
form.append("file", new Blob([fs.readFileSync(audio)]), path.basename(audio));
form.append("model", "whisper-1");
form.append("language", "de");
form.append("response_format", "verbose_json");
form.append("timestamp_granularities[]", "word");

const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
if (!res.ok) {
  console.error(`Whisper-Fehler ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();

// Whisper liefert Wörter ohne Satzzeichen – aus dem Volltext wieder anhängen.
const tokens = data.text.trim().split(/\s+/);
let ti = 0;
const strip = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const words = data.words.map((w) => {
  let text = w.word.trim();
  for (let k = ti; k < Math.min(ti + 3, tokens.length); k++) {
    if (strip(tokens[k]) === strip(text)) {
      text = tokens[k];
      ti = k + 1;
      break;
    }
  }
  return { text, start: +w.start.toFixed(3), end: +w.end.toFixed(3) };
});

const file = saveWords(dir, words);
console.log(`${words.length} Wörter mit Zeitstempeln → ${path.relative(process.cwd(), file)}`);
