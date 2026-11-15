import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../timeline";

const GROUP = 4;

/** Untertitel: Gruppen à 4 Wörter, das gerade gesprochene Wort leuchtet. */
export const Captions: React.FC<{ words: Word[]; accent: string }> = ({ words, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Gruppen bilden (Satzende beendet Gruppe)
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= GROUP || /[.!?,:;]$/.test(w.text)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);

  const g = groups.find((gr, i) => {
    const next = groups[i + 1];
    return t >= gr[0].start && t < (next ? next[0].start : gr[gr.length - 1].end + 0.6);
  });
  if (!g) return null;

  const pop = spring({ frame: frame - Math.round(g[0].start * fps), fps, config: { damping: 14, stiffness: 200 } });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 300,
        left: 60,
        right: 60,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px 18px",
        transform: `scale(${0.85 + 0.15 * pop})`,
      }}
    >
      {g.map((w, i) => {
        const active = t >= w.start && t < w.end + 0.05;
        const spoken = t >= w.start;
        return (
          <span
            key={i}
            style={{
              fontSize: 74,
              fontWeight: 900,
              letterSpacing: -1,
              color: active ? "#1a0b06" : "#fff",
              background: active ? accent : "transparent",
              padding: "2px 16px",
              borderRadius: 16,
              opacity: spoken ? 1 : 0.45,
              textShadow: active ? "none" : "0 4px 24px rgba(0,0,0,0.8)",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
