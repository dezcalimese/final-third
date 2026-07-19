import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

function Step({
  number,
  title,
  description,
  color,
}: {
  number: string;
  title: string;
  description: string;
  color: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 28,
        opacity: entrance,
        transform: `translateX(${interpolate(entrance, [0, 1], [60, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: `${color}22`,
          border: `2px solid ${color}66`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 900,
          color,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "#f4f7f5", marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 22, color: "#f4f7f5aa", lineHeight: 1.4 }}>{description}</div>
      </div>
    </div>
  );
}

export const HowItWorksScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050b08",
        padding: 80,
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: "#f4f7f5",
          marginBottom: 56,
          opacity: headerIn,
          transform: `translateY(${interpolate(headerIn, [0, 1], [-30, 0])}px)`,
          letterSpacing: -1,
        }}
      >
        How It Works
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 900 }}>
        <Sequence from={10} premountFor={fps} layout="none">
          <Step
            number="1"
            title="Danger Phase Triggers"
            description="TxLINE detects a team's pressure escalating to danger or high danger."
            color="#f59e0b"
          />
        </Sequence>

        <Sequence from={Math.round(1.8 * fps)} premountFor={fps} layout="none">
          <Step
            number="2"
            title="4 Seconds to Call It"
            description="ATTACK (shot, corner, or goal) or DEFENSE (they clear it). Lock in your pick."
            color="#3b82f6"
          />
        </Sequence>

        <Sequence from={Math.round(3.6 * fps)} premountFor={fps} layout="none">
          <Step
            number="3"
            title="Event-Driven Resolution"
            description="The phase plays out in real time — 2 to 58 seconds. First confirmed event resolves it."
            color="#10b981"
          />
        </Sequence>

        <Sequence from={Math.round(5.4 * fps)} premountFor={fps} layout="none">
          <Step
            number="4"
            title="Build Your Streak"
            description="Every call graded against the verified feed. Chain correct picks into a streak."
            color="#8b5cf6"
          />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
