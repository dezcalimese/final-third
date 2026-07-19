import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame, fps, config: { damping: 200 } });
  const subtitleIn = spring({ frame, fps, delay: 20, config: { damping: 200 } });
  const fadeOut = interpolate(frame, [6 * fps, 7.5 * fps], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulseOpacity = interpolate(
    frame % (fps * 2),
    [0, fps, fps * 2],
    [0.15, 0.25, 0.15]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050b08",
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(37,99,235,${pulseOpacity}) 0%, transparent 70%)`,
        }}
      />
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#f4f7f5",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [40, 0])}px)`,
            letterSpacing: -2,
          }}
        >
          Watching a match alone
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#f4f7f5",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [40, 0])}px)`,
            letterSpacing: -2,
          }}
        >
          is <span style={{ color: "#4b5563" }}>passive.</span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#f4f7f5aa",
            marginTop: 32,
            opacity: subtitleIn,
            transform: `translateY(${interpolate(subtitleIn, [0, 1], [20, 0])}px)`,
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          You watch. You react. But you never get to prove you read the game.
        </div>
      </div>
    </AbsoluteFill>
  );
};
