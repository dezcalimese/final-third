import type { TeamTheme } from "@final-third/shared";

export interface ShareCardData {
  home: TeamTheme;
  away: TeamTheme;
  streak: number;
  best: number;
  accuracy: number; // 0-100
  beatPercent: number; // 0-100, "beat X% of players"
}

const SUBDIVISION_FLAGS: Record<string, string> = {
  "gb-eng": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "gb-sct": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "gb-wls": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
};

function isoToFlagEmoji(iso: string): string {
  if (SUBDIVISION_FLAGS[iso]) return SUBDIVISION_FLAGS[iso];
  const code = iso.slice(0, 2).toUpperCase();
  return [...code].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export function ShareCardContent({ home, away, streak, best, accuracy, beatPercent }: ShareCardData) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 56,
        background: `linear-gradient(135deg, ${home.primary}33 0%, #050b08 45%, ${away.primary}33 100%)`,
        backgroundColor: "#050b08",
        color: "#f4f7f5",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#f4f7f5cc" }}>
          FINAL THIRD
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: "#f4f7f5aa" }}>
          <span style={{ display: "flex", fontSize: 36 }}>{isoToFlagEmoji(home.iso)}</span>
          {home.name.toUpperCase()}
          <span style={{ display: "flex", color: "#f4f7f544", fontSize: 18 }}>v</span>
          {away.name.toUpperCase()}
          <span style={{ display: "flex", fontSize: 36 }}>{isoToFlagEmoji(away.iso)}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ display: "flex", fontSize: 172, fontWeight: 900, lineHeight: 1 }}>{streak}</span>
          <span style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#f4f7f5aa" }}>in a row</span>
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#f4f7f5cc", marginTop: 12 }}>
          I read the match — can you beat it?
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Best streak" value={String(best)} />
        <Stat label="Beat" value={`${beatPercent}% of players`} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 24,
          fontSize: 14,
          color: "#f4f7f544",
          letterSpacing: 1,
        }}
      >
        Every call graded against the verified TxLINE feed · free to play
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ display: "flex", fontSize: 26, fontWeight: 800 }}>{value}</span>
      <span style={{ display: "flex", fontSize: 13, color: "#f4f7f566", letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}
