import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

function ArchBox({
  label,
  sublabel,
  color,
  width,
}: {
  label: string;
  sublabel: string;
  color: string;
  width: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        width,
        padding: "28px 32px",
        borderRadius: 16,
        background: `${color}15`,
        border: `2px solid ${color}55`,
        opacity: entrance,
        transform: `scale(${interpolate(entrance, [0, 1], [0.85, 1])})`,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{label}</div>
      <div style={{ fontSize: 16, color: "#f4f7f5aa", marginTop: 6 }}>{sublabel}</div>
    </div>
  );
}

function Arrow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        fontSize: 36,
        color: "#f4f7f544",
        opacity: entrance,
        padding: "0 16px",
      }}
    >
      →
    </div>
  );
}

export const ArchitectureScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 200 } });
  const apiNote = spring({ frame, fps, delay: Math.round(4 * fps), config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050b08",
        padding: 80,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: "#f4f7f5",
          marginBottom: 16,
          opacity: headerIn,
          transform: `translateY(${interpolate(headerIn, [0, 1], [-30, 0])}px)`,
          letterSpacing: -1,
        }}
      >
        Powered by TxLINE
      </div>
      <div
        style={{
          fontSize: 24,
          color: "#f4f7f566",
          marginBottom: 60,
          opacity: headerIn,
        }}
      >
        Real-time scores feed drives every prediction round
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <Sequence from={10} premountFor={fps} layout="none">
          <ArchBox label="TxLINE API" sublabel="Live SSE scores stream" color="#f59e0b" width={240} />
        </Sequence>

        <Sequence from={Math.round(1 * fps)} premountFor={fps} layout="none">
          <Arrow />
        </Sequence>

        <Sequence from={Math.round(1.5 * fps)} premountFor={fps} layout="none">
          <ArchBox label="Relay Server" sublabel="RoundEngine + GameRoom" color="#3b82f6" width={280} />
        </Sequence>

        <Sequence from={Math.round(2 * fps)} premountFor={fps} layout="none">
          <Arrow />
        </Sequence>

        <Sequence from={Math.round(2.5 * fps)} premountFor={fps} layout="none">
          <ArchBox label="Browser" sublabel="Next.js + SSE fan-out" color="#10b981" width={240} />
        </Sequence>

        <Sequence from={Math.round(3 * fps)} premountFor={fps} layout="none">
          <Arrow />
        </Sequence>

        <Sequence from={Math.round(3.5 * fps)} premountFor={fps} layout="none">
          <ArchBox label="Redis" sublabel="Streaks + leaderboard" color="#8b5cf6" width={220} />
        </Sequence>
      </div>

      <div
        style={{
          display: "flex",
          gap: 48,
          marginTop: 56,
          opacity: apiNote,
          transform: `translateY(${interpolate(apiNote, [0, 1], [20, 0])}px)`,
        }}
      >
        {[
          { method: "POST", path: "/auth/guest/start", desc: "JWT auth" },
          { method: "GET", path: "/api/scores/stream", desc: "Live events" },
          { method: "GET", path: "/api/scores/historical/{id}", desc: "Replay data" },
          { method: "GET", path: "/api/odds/stream", desc: "Market odds" },
        ].map((ep) => (
          <div key={ep.path} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", letterSpacing: 1 }}>
              {ep.method}
            </div>
            <div
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                color: "#f4f7f5aa",
                marginTop: 4,
              }}
            >
              {ep.path}
            </div>
            <div style={{ fontSize: 13, color: "#f4f7f544", marginTop: 4 }}>{ep.desc}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
