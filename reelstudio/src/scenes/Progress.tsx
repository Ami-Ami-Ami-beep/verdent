import { useCurrentFrame, useVideoConfig } from "remotion";

export const Progress: React.FC<{ accent: string }> = ({ accent }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 70, left: 60, right: 60, height: 8, borderRadius: 8, background: "rgba(255,255,255,0.12)" }}>
      <div
        style={{
          width: `${(f / durationInFrames) * 100}%`,
          height: "100%",
          borderRadius: 8,
          background: accent,
          boxShadow: `0 0 20px ${accent}`,
        }}
      />
    </div>
  );
};
