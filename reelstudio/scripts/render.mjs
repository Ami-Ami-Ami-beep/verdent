// Rendert ein Reel: npm run render -- <reel>  →  out/<reel>.mp4
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readJson, reelDir, root } from "./lib.mjs";

const name = process.argv[2];
const dir = reelDir(name);
const reel = readJson(path.join(dir, "reel.json"));
if (!reel.words?.length) {
  console.error("reel.json hat keine Wörter. Erst `npm run timing` oder `npm run transcribe` ausführen.");
  process.exit(1);
}

// Medien (voice/avatar/music) nach public/reels/<name>/ kopieren und Pfade umschreiben
const pub = path.join(root, "public", "reels", name);
fs.mkdirSync(pub, { recursive: true });
for (const key of ["audio", "avatar", "music"]) {
  const v = reel[key];
  if (!v || /^https?:\/\//.test(v)) continue;
  const srcFile = path.resolve(dir, v);
  if (!fs.existsSync(srcFile)) {
    console.warn(`⚠ ${key}: ${v} nicht gefunden – wird weggelassen`);
    reel[key] = null;
    continue;
  }
  fs.copyFileSync(srcFile, path.join(pub, path.basename(srcFile)));
  reel[key] = `reels/${name}/${path.basename(srcFile)}`;
}

// Optional eigenen Browser nutzen (z. B. wenn der Download von Chrome blockiert ist)
const browserExecutable = process.env.REMOTION_BROWSER || null;

console.log("Bündeln …");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts") });
const inputProps = { reel };
const composition = await selectComposition({ serveUrl, id: "Reel", inputProps, browserExecutable });

const outFile = path.join(root, "out", `${name}.mp4`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: outFile,
  inputProps,
  browserExecutable,
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) {
      last = p;
      process.stdout.write(`\rRendern ${Math.round(progress * 100)} %`);
    }
  },
});
console.log(`\nFertig → ${path.relative(process.cwd(), outFile)}`);
