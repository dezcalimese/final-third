import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame, fps, config: { damping: 200 } });
  const subtitleIn = spring({ frame, fps, delay: 15, config: { damping: 200 } });
  const detailsIn = spring({ frame, fps, delay: 30, config: { damping: 200 } });

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
            "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.12) 0%, transparent 60%)",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: "#f4f7f5",
            opacity: titleIn,
            transform: `scale(${interpolate(titleIn, [0, 1], [0.85, 1])})`,
            letterSpacing: -2,
          }}
        >
          Final Third
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#f4f7f5cc",
            marginTop: 20,
            opacity: subtitleIn,
            transform: `translateY(${interpolate(subtitleIn, [0, 1], [20, 0])}px)`,
          }}
        >
          Read the pressure. Call the play. Build your streak.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 48,
            marginTop: 56,
            opacity: detailsIn,
          }}
        >
          {[
            { label: "No stakes", value: "Free forever" },
            { label: "Identity", value: "Privy wallet" },
            { label: "Data", value: "TxLINE verified" },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f7f5" }}>{item.value}</div>
              <div
                style={{
                  fontSize: 13,
                  color: "#f4f7f566",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginTop: 6,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: 18,
            color: "#f4f7f544",
            marginTop: 56,
            letterSpacing: 3,
            opacity: detailsIn,
          }}
        >
          TXODDS WORLD CUP HACKATHON · TRACK 2
        </div>
      </div>
    </AbsoluteFill>
  );
};
