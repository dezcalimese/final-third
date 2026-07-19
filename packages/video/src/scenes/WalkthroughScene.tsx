import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, staticFile } from "remotion";

const SCREENS = [
  { src: "screenshots/picker.png", label: "Pick a match" },
  { src: "screenshots/predict.png", label: "Call the play" },
  { src: "screenshots/result.png", label: "Instant result" },
  { src: "screenshots/stats.png", label: "Live stats" },
];

function PhoneFrame({ src, label, index }: { src: string; label: string; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [40, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 240,
          height: 430,
          borderRadius: 22,
          overflow: "hidden",
          border: "3px solid #ffffff15",
          background: "#0a0f0c",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#f4f7f5aa",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export const WalkthroughScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 200 } });

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
            "radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 60%)",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: "#f4f7f5",
            marginBottom: 48,
            opacity: headerIn,
            transform: `translateY(${interpolate(headerIn, [0, 1], [-30, 0])}px)`,
            letterSpacing: -1,
          }}
        >
          Live App Walkthrough
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
          {SCREENS.map((screen, i) => (
            <Sequence key={screen.label} from={Math.round(i * 0.9 * fps)} premountFor={fps} layout="none">
              <PhoneFrame src={screen.src} label={screen.label} index={i} />
            </Sequence>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
