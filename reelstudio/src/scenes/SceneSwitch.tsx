import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { wordsBetween, type ResolvedScene, type Word } from "../timeline";
import { MUTED } from "../theme";

type P = { scene: ResolvedScene; words: Word[]; accent: string };

/** Frame (relativ zur Szene), an dem eine absolute Zeit erreicht ist. */
const useRel = (scene: ResolvedScene) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, since: (abs: number) => frame - Math.round((abs - scene.start) * fps) };
};

const pop = (f: number, fps: number) => spring({ frame: f, fps, config: { damping: 12, stiffness: 180 } });

const Kicker: React.FC<{ text?: string; accent: string }> = ({ text, accent }) =>
  text ? (
    <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", color: accent, marginBottom: 36 }}>
      {text}
    </div>
  ) : null;

const glass = (accent: string, on = false): React.CSSProperties => ({
  background: on ? `${accent}26` : "rgba(20,10,10,0.72)",
  border: `4px solid ${on ? accent : accent + "88"}`,
  boxShadow: `0 0 ${on ? 60 : 30}px ${accent}${on ? "aa" : "55"}, inset 0 0 30px ${accent}22`,
  borderRadius: 32,
});

const Title: React.FC<P> = ({ scene, accent }) => {
  const { frame, fps } = useRel(scene);
  const parts = (scene.text ?? "").split(" ");
  return (
    <div style={{ textAlign: "center", padding: "0 70px" }}>
      <Kicker text={scene.kicker} accent={accent} />
      <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1.02, letterSpacing: -4 }}>
        {parts.map((p, i) => {
          const s = pop(frame - i * 3, fps);
          return (
            <span key={i} style={{ display: "inline-block", marginRight: 30, transform: `translateY(${(1 - s) * 80}px)`, opacity: s }}>
              {p}
            </span>
          );
        })}
      </div>
      <div style={{ margin: "50px auto 0", height: 10, borderRadius: 10, background: accent, width: `${interpolate(frame, [4, 22], [0, 60], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}%` }} />
    </div>
  );
};

const Chips: React.FC<P> = ({ scene, accent }) => {
  const { fps, since } = useRel(scene);
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <Kicker text={scene.kicker} accent={accent} />
      {scene.text ? <div style={{ fontSize: 96, fontWeight: 900, marginBottom: 60, letterSpacing: -2 }}>{scene.text}</div> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "center", padding: "0 60px" }}>
        {(scene.items ?? []).map((it, i) => {
          const s = pop(since(scene.itemTimes[i]), fps);
          return (
            <div
              key={i}
              style={{
                ...glass(accent, s > 0.5),
                padding: "34px 46px",
                fontSize: 62,
                fontWeight: 800,
                opacity: s,
                transform: `scale(${0.4 + 0.6 * s}) rotate(${(1 - s) * (i % 2 ? 8 : -8)}deg)`,
              }}
            >
              {it.label}
              {it.sub ? <div style={{ fontSize: 34, fontWeight: 500, color: MUTED, marginTop: 8 }}>{it.sub}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Cards: React.FC<P> = ({ scene, accent }) => {
  const { frame, fps, since } = useRel(scene);
  const items = scene.items ?? [];
  const n = items.length;
  const pickF = scene.pickTime != null ? since(scene.pickTime) : -1;
  const picked = scene.pick != null ? pop(pickF, fps) : 0;
  const colors = ["#ff8a5c", "#9be7a4", "#fff2e6", "#9be7a4", "#ff8a5c", "#ffd36b"];
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <Kicker text={scene.kicker} accent={accent} />
      {scene.text ? <div style={{ fontSize: 96, fontWeight: 900, marginBottom: 80, letterSpacing: -2 }}>{scene.text}</div> : null}
      <div style={{ position: "relative", height: 620 }}>
        {items.map((it, i) => {
          const s = pop(since(scene.itemTimes[i]) , fps);
          const mid = (n - 1) / 2;
          const isPick = scene.pick === i;
          const fanAngle = (i - mid) * 9;
          const fanX = (i - mid) * 115;
          const fanY = Math.abs(i - mid) * 30;
          const x = interpolate(picked, [0, 1], [fanX, isPick ? 0 : (i - mid) * 210]);
          const y = interpolate(picked, [0, 1], [fanY, isPick ? -30 : 260]);
          const rot = interpolate(picked, [0, 1], [fanAngle, 0]);
          const sc = interpolate(picked, [0, 1], [1, isPick ? 1.25 : 0.55]);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                width: 330,
                height: 460,
                marginLeft: -165,
                borderRadius: 30,
                background: colors[i % colors.length],
                border: `6px solid ${isPick && picked > 0.5 ? accent : "rgba(0,0,0,0.25)"}`,
                boxShadow: isPick && picked > 0.5 ? `0 0 90px ${accent}` : "0 30px 60px rgba(0,0,0,0.5)",
                color: "#2a120a",
                padding: 30,
                textAlign: "left",
                transform: `translate(${x}px, ${y + (1 - s) * 500}px) rotate(${rot}deg) scale(${sc})`,
                opacity: s * (isPick || picked < 0.01 ? 1 : 1 - picked * 0.5),
                zIndex: isPick ? 10 : i,
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 20 }}>{it.label}</div>
              {Array.from({ length: 7 }).map((_, k) => (
                <div key={k} style={{ height: 14, borderRadius: 7, background: "rgba(42,18,10,0.22)", margin: "16px 0", width: `${90 - ((k * 23 + i * 7) % 40)}%` }} />
              ))}
            </div>
          );
        })}
        {scene.pick != null && picked > 0.05 ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -40,
              marginLeft: 90,
              padding: "14px 30px",
              borderRadius: 18,
              background: accent,
              color: "#1a0b06",
              fontSize: 44,
              fontWeight: 900,
              zIndex: 20,
              transform: `rotate(-8deg) scale(${picked})`,
            }}
          >
            Gewählt
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Words: React.FC<P> = ({ scene, words, accent }) => {
  const { frame, fps, since } = useRel(scene);
  const t = scene.start + frame / fps;
  const ws = wordsBetween(words, scene.start, scene.end);
  return (
    <div style={{ textAlign: "center", width: "100%", padding: "0 50px" }}>
      <Kicker text={scene.kicker} accent={accent} />
      {scene.text ? <div style={{ fontSize: 90, fontWeight: 900, marginBottom: 60, letterSpacing: -2 }}>{scene.text}</div> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, justifyContent: "center" }}>
        {ws.map((w, i) => {
          const s = pop(since(w.start), fps);
          const active = t >= w.start && t < w.end + 0.05;
          return (
            <div
              key={i}
              style={{
                padding: "22px 30px",
                borderRadius: 20,
                fontSize: 52,
                fontWeight: 800,
                background: active ? accent : "#f4ece6",
                color: "#1a0b06",
                boxShadow: active ? `0 0 50px ${accent}` : "0 14px 0 #b9aaa0",
                transform: `translateY(${(1 - s) * -160 + (active ? 10 : 0)}px)`,
                opacity: s,
              }}
            >
              {w.text.replace(/[.,!?;:]$/, "")}
              <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.55, marginTop: 4 }}>{w.start.toFixed(2)}s</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Steps: React.FC<P> = ({ scene, accent }) => {
  const { frame, fps, since } = useRel(scene);
  const items = scene.items ?? [];
  const active = (scene.step ?? 1) - 1;
  const intro = pop(frame, fps);
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <Kicker text={scene.kicker ?? `Schritt ${active + 1} / ${items.length}`} accent={accent} />
      <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: -3, marginBottom: 70, transform: `scale(${0.7 + 0.3 * intro})` }}>
        {scene.text ?? items[active]?.label}
      </div>
      <div style={{ display: "flex", gap: 22, justifyContent: "center" }}>
        {items.map((it, i) => {
          const s = pop(since(scene.itemTimes[i] ?? scene.start), fps);
          const on = i === active;
          const done = i < active;
          return (
            <div
              key={i}
              style={{
                width: 104,
                height: 104,
                borderRadius: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 50,
                fontWeight: 900,
                background: on ? accent : done ? `${accent}55` : "rgba(255,255,255,0.1)",
                color: on ? "#1a0b06" : "#fff",
                boxShadow: on ? `0 0 60px ${accent}` : "none",
                transform: `scale(${(on ? 1.18 : 1) * s})`,
              }}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
      {items[active]?.sub ? <div style={{ fontSize: 46, color: MUTED, marginTop: 60, padding: "0 80px" }}>{items[active].sub}</div> : null}
    </div>
  );
};

const Wave: React.FC<P> = ({ scene, accent }) => {
  const { frame, fps, since } = useRel(scene);
  const items = scene.items ?? [];
  const pickF = scene.pickTime != null ? since(scene.pickTime) : -1;
  return (
    <div style={{ textAlign: "center", width: "100%", padding: "0 60px" }}>
      <Kicker text={scene.kicker} accent={accent} />
      {scene.text ? <div style={{ fontSize: 96, fontWeight: 900, marginBottom: 60, letterSpacing: -2 }}>{scene.text}</div> : null}
      {items.map((it, i) => {
        const s = pop(since(scene.itemTimes[i]), fps);
        const isPick = scene.pick === i && pickF >= 0;
        return (
          <div
            key={i}
            style={{
              ...glass(accent, isPick),
              display: "flex",
              alignItems: "center",
              gap: 30,
              padding: "26px 36px",
              marginBottom: 30,
              opacity: s * (scene.pick != null && pickF >= 0 && !isPick ? 0.4 : 1),
              transform: `translateX(${(1 - s) * (i % 2 ? 600 : -600)}px)`,
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 900, width: 200, textAlign: "left" }}>{it.label}</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, height: 110 }}>
              {Array.from({ length: 40 }).map((_, k) => {
                const h = 20 + Math.abs(Math.sin(k * 0.9 + i * 2 + frame * 0.25) * Math.cos(k * 0.37 + i)) * 90;
                return <div key={k} style={{ flex: 1, height: h, borderRadius: 4, background: i % 2 ? "#c79bff" : "#7fd6ff" }} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Outro: React.FC<P> = ({ scene, accent }) => {
  const { frame, fps } = useRel(scene);
  const s = pop(frame, fps);
  return (
    <div style={{ textAlign: "center", padding: "0 80px", transform: `scale(${0.8 + 0.2 * s})`, opacity: s }}>
      <Kicker text={scene.kicker} accent={accent} />
      <div style={{ fontSize: 110, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05 }}>{scene.text}</div>
      {(scene.items ?? []).length ? (
        <div style={{ ...glass(accent, true), display: "inline-block", marginTop: 70, padding: "30px 60px", fontSize: 56, fontWeight: 800 }}>
          {scene.items![0].label}
        </div>
      ) : null}
    </div>
  );
};

export const SceneSwitch: React.FC<P> = (p) => {
  switch (p.scene.type) {
    case "title":
      return <Title {...p} />;
    case "chips":
      return <Chips {...p} />;
    case "cards":
      return <Cards {...p} />;
    case "words":
      return <Words {...p} />;
    case "steps":
      return <Steps {...p} />;
    case "wave":
      return <Wave {...p} />;
    case "outro":
      return <Outro {...p} />;
    default:
      return <Title {...p} />;
  }
};
