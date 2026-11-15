import { Composition } from "remotion";
import { Reel } from "./Reel";
import { reelDuration, type ReelData } from "./timeline";
import demo from "../reels/demo/reel.json";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={{ reel: demo as ReelData }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.ceil(reelDuration(props.reel) * 30),
    })}
  />
);
