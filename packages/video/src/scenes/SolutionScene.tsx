import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const SolutionScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 200 } });
  const taglineIn = spring({ frame, fps, delay: 15, config: { damping: 200 } });
  const flagsIn = spring({ frame, fps, delay: 30, config: { damping: 15 } });
  const detailIn = spring({ frame, fps, delay: 50, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050b08",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 30% 40%, rgba(0,36,156,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(170,0,0,0.12) 0%, transparent 60%)",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 10,
            color: "#f4f7f5aa",
            opacity: logoIn,
            transform: `translateY(${interpolate(logoIn, [0, 1], [-20, 0])}px)`,
            marginBottom: 20,
          }}
        >
          INTRODUCING
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "#f4f7f5",
            opacity: logoIn,
            transform: `scale(${interpolate(logoIn, [0, 1], [0.8, 1])})`,
            letterSpacing: -3,
          }}
        >
          Final Third
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#f4f7f5cc",
            marginTop: 20,
            opacity: taglineIn,
            transform: `translateY(${interpolate(taglineIn, [0, 1], [20, 0])}px)`,
          }}
        >
          A free, no-stakes World Cup prediction game
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 40,
            marginTop: 48,
            opacity: flagsIn,
            transform: `scale(${interpolate(flagsIn, [0, 1], [0.5, 1])})`,
          }}
        >
          {["🇫🇷", "🇪🇸", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇦🇷"].map((flag, i) => (
            <span key={i} style={{ fontSize: 64 }}>{flag}</span>
          ))}
        </div>

        <div
          style={{
            fontSize: 22,
            color: "#f4f7f566",
            marginTop: 36,
            opacity: detailIn,
            letterSpacing: 2,
          }}
        >
          TxODDS HACKATHON · TRACK 2: CONSUMER & FAN EXPERIENCES
        </div>
      </div>
    </AbsoluteFill>
  );
};
