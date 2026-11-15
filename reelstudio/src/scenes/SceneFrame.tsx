import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

/** Ein-/Ausblenden jeder Szene mit leichtem Zoom und Unschärfe. */
export const SceneFrame: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const f = useCurrentFrame();
  const inT = interpolate(f, [0, 9], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const outT = interpolate(f, [duration - 7, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = 0.94 + 0.06 * inT + 0.06 * outT;
  const blur = (1 - inT) * 14 + outT * 14;
  return (
    <AbsoluteFill
      style={{
        opacity: inT * (1 - outT),
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 380,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
