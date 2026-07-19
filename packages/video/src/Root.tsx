import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";

const FPS = 30;
const DURATION_SECONDS = 71;

export const RemotionRoot = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
