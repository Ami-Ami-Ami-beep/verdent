// Datenformat eines Reels + Auflösung der Wort-Anker ("on") zu Zeiten.

export type Word = { text: string; start: number; end: number };

export type Anchored = { on?: string; at?: number };

export type Item = Anchored & { label: string; sub?: string };

export type Scene = Anchored & {
  type: "title" | "chips" | "cards" | "words" | "steps" | "wave" | "outro";
  text?: string;
  kicker?: string;
  items?: Item[];
  pick?: number; // cards: welche Karte gewählt wird
  pickOn?: string; // cards: ab welchem Wort die Wahl sichtbar wird
  step?: number; // steps: aktiver Schritt (1-basiert)
  accent?: string;
};

export type ReelData = {
  title: string;
  accent?: string;
  audio?: string | null; // Pfad relativ zu public/
  avatar?: string | null; // Avatar-Video (z. B. aus HeyGen), relativ zu public/
  music?: string | null;
  musicVolume?: number;
  captions?: boolean;
  words: Word[];
  scenes: Scene[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ß]+/g, "");

/** Findet eine Wortfolge ab Index `from`. Gibt den Index des ersten Worts zurück oder -1. */
export function findPhrase(words: Word[], phrase: string, from = 0): number {
  const target = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (!target.length) return -1;
  for (let i = Math.max(0, from); i <= words.length - target.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (norm(words[i + j].text) !== target[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export function anchorTime(words: Word[], a: Anchored, from = 0, fallback = 0): { t: number; idx: number } {
  if (typeof a.at === "number") return { t: a.at, idx: from };
  if (a.on) {
    const idx = findPhrase(words, a.on, from);
    if (idx >= 0) return { t: words[idx].start, idx };
    // nicht gefunden -> im ganzen Text suchen, sonst Fallback
    const any = findPhrase(words, a.on, 0);
    if (any >= 0) return { t: words[any].start, idx: any };
    console.warn(`[reel] Anker nicht gefunden: "${a.on}"`);
  }
  return { t: fallback, idx: from };
}

export type ResolvedScene = Scene & {
  start: number;
  end: number;
  itemTimes: number[];
  pickTime: number | null;
};

export function reelDuration(reel: ReelData): number {
  const last = reel.words.length ? reel.words[reel.words.length - 1].end : 5;
  return last + 1.2;
}

export function resolveScenes(reel: ReelData): ResolvedScene[] {
  const { words } = reel;
  const total = reelDuration(reel);
  let cursor = 0;
  const starts = reel.scenes.map((s, i) => {
    const r = anchorTime(words, s, cursor, i === 0 ? 0 : NaN);
    cursor = r.idx;
    return r;
  });
  // fehlende Starts gleichmäßig verteilen
  const times = starts.map((s) => s.t);
  for (let i = 0; i < times.length; i++) {
    if (Number.isNaN(times[i])) times[i] = i === 0 ? 0 : times[i - 1] + 1.5;
  }
  return reel.scenes.map((s, i) => {
    const start = i === 0 ? 0 : times[i];
    const end = i + 1 < times.length ? times[i + 1] : total;
    let c = starts[i].idx;
    const itemTimes = (s.items ?? []).map((it, k) => {
      const r = anchorTime(words, it, c, start + k * 0.35);
      c = r.idx;
      return Math.max(start, r.t);
    });
    const pickTime = s.pickOn ? anchorTime(words, { on: s.pickOn }, starts[i].idx, start + 1).t : null;
    return { ...s, start, end, itemTimes, pickTime };
  });
}

/** Wörter, die in [start, end) gesprochen werden. */
export function wordsBetween(words: Word[], start: number, end: number): Word[] {
  return words.filter((w) => w.start >= start - 0.01 && w.start < end);
}
