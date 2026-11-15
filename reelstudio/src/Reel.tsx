import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { resolveScenes, type ReelData } from "./timeline";
import { Background } from "./scenes/Background";
import { Captions } from "./scenes/Captions";
import { Progress } from "./scenes/Progress";
import { SceneFrame } from "./scenes/SceneFrame";
import { SceneSwitch } from "./scenes/SceneSwitch";
import { DEFAULT_ACCENT, FONT, INK } from "./theme";

const src = (p: string) => (/^https?:\/\//.test(p) ? p : staticFile(p));

export const Reel: React.FC<{ reel: ReelData }> = ({ reel }) => {
  const { fps } = useVideoConfig();
  const scenes = resolveScenes(reel);
  const accent = reel.accent ?? DEFAULT_ACCENT;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: INK }}>
      <Background accent={accent} />

      {scenes.map((s, i) => {
        const from = Math.round(s.start * fps);
        const dur = Math.max(1, Math.round(s.end * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur} name={`${i + 1}: ${s.type}`}>
            <SceneFrame duration={dur}>
              <SceneSwitch scene={s} words={reel.words} accent={s.accent ?? accent} />
            </SceneFrame>
          </Sequence>
        );
      })}

      {reel.avatar ? (
        <div
          style={{
            position: "absolute",
            right: 60,
            bottom: 520,
            width: 360,
            height: 480,
            borderRadius: 36,
            overflow: "hidden",
            border: `4px solid ${accent}`,
            boxShadow: `0 0 60px ${accent}66`,
          }}
        >
          <OffthreadVideo src={src(reel.avatar)} muted={!!reel.audio} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : null}

      {reel.captions !== false ? <Captions words={reel.words} accent={accent} /> : null}
      <Progress accent={accent} />

      {reel.audio ? <Audio src={src(reel.audio)} /> : null}
      {reel.music ? <Audio src={src(reel.music)} volume={reel.musicVolume ?? 0.12} /> : null}
    </AbsoluteFill>
  );
};
