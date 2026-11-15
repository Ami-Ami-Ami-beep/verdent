import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BG } from "../theme";

export const Background: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const gridShift = (t * 60) % 120;
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 900px at ${50 + Math.sin(t * 0.4) * 15}% ${30 + Math.cos(t * 0.3) * 8}%, ${accent}55, transparent 60%),
                       radial-gradient(900px 700px at ${20 + Math.cos(t * 0.5) * 10}% 85%, #ff2e6340, transparent 65%)`,
        }}
      />
      {/* Perspektiv-Raster am Boden */}
      <div
        style={{
          position: "absolute",
          left: "-50%",
          right: "-50%",
          bottom: -200,
          height: 1100,
          transform: "perspective(700px) rotateX(62deg)",
          transformOrigin: "50% 100%",
          backgroundImage: `linear-gradient(${accent}38 2px, transparent 2px), linear-gradient(90deg, ${accent}38 2px, transparent 2px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: `0 ${gridShift}px`,
          maskImage: "linear-gradient(to top, black 10%, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to top, black 10%, transparent 85%)",
        }}
      />
      {/* schwebende Lichtpunkte */}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = (i * 137) % 1080;
        const y = (((i * 263) % 1920) - t * (20 + (i % 5) * 12) + 4000) % 1920;
        const s = 4 + (i % 4) * 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: s,
              background: i % 3 ? accent : "#fff",
              opacity: 0.35,
              boxShadow: `0 0 ${s * 4}px ${accent}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
