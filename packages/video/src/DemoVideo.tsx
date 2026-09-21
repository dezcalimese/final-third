import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { WalkthroughScene } from "./scenes/WalkthroughScene";
import { HowItWorksScene } from "./scenes/HowItWorksScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { OutroScene } from "./scenes/OutroScene";

const FPS = 30;
const TRANSITION_FRAMES = 15;

export const DemoVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050b08" }}>
      <TransitionSeries>
        {/* Scene 1: Problem (audio ~7.4s, pad to 10s) */}
        <TransitionSeries.Sequence durationInFrames={10 * FPS}>
          <ProblemScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 2: Solution (audio ~10s, pad to 12s) */}
        <TransitionSeries.Sequence durationInFrames={12 * FPS}>
          <SolutionScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 3: Walkthrough (new, ~10s) */}
        <TransitionSeries.Sequence durationInFrames={10 * FPS}>
          <WalkthroughScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 4: How It Works (audio ~14s, pad to 16s) */}
        <TransitionSeries.Sequence durationInFrames={16 * FPS}>
          <HowItWorksScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 5: Architecture (audio ~12s, pad to 14s) */}
        <TransitionSeries.Sequence durationInFrames={14 * FPS}>
          <ArchitectureScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 6: Outro (audio ~6.6s, pad to 9s) */}
        <TransitionSeries.Sequence durationInFrames={9 * FPS}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
