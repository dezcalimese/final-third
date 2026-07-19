import type { FixtureTheme, MatchState, TeamTheme } from "@final-third/shared";
import { useNow } from "@/lib/useNow";

const PHASE_LABEL: Record<MatchState["phase"], string> = {
  SCHEDULED: "Kickoff soon",
  H1: "1st Half",
  HT: "Half-Time",
  H2: "2nd Half",
  FT: "Full-Time",
  ET: "Extra Time",
  PENS: "Penalties",
  UNKNOWN: "—",
};

function formatClock(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.floor(totalSeconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function useInterpolatedClock(matchState: MatchState): { display: string | null; seconds: number | null } {
  const now = useNow(500);
  if (matchState.clockSeconds === null || matchState.clockUpdatedAtMs === null) {
    return { display: matchState.clock, seconds: matchState.clockSeconds };
  }
  if (!matchState.clockRunning) {
    return { display: formatClock(matchState.clockSeconds), seconds: matchState.clockSeconds };
  }
  const interpolated = matchState.clockSeconds + (now - matchState.clockUpdatedAtMs) / 1000;
  return { display: formatClock(interpolated), seconds: interpolated };
}

function getClockAnnotation(phase: MatchState["phase"], seconds: number | null, running: boolean): string | null {
  if (phase === "HT") return "Half-Time Break";
  if (phase === "SCHEDULED") return null;
  if (phase === "FT") return null;

  if ((phase === "H1" || phase === "H2") && !running) return "Play Stopped";

  if (seconds === null) return null;
  const h1End = 45 * 60;
  const h2End = 90 * 60;
  if (phase === "H1" && seconds > h1End) {
    const added = Math.ceil((seconds - h1End) / 60);
    return `+${added} Added Time`;
  }
  if (phase === "H2" && seconds > h2End) {
    const added = Math.ceil((seconds - h2End) / 60);
    return `+${added} Added Time`;
  }
  return null;
}

function TeamColumn({ team, align }: { team: TeamTheme | undefined; align: "left" | "right" }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-2 ${align === "left" ? "sm:items-end" : "sm:items-start"}`}>
      {team ? (
        <span className={`fi fi-${team.iso} text-6xl sm:text-7xl`} style={{ lineHeight: "1em" }} aria-hidden />
      ) : (
        <span className="flex h-[1em] w-[1.33em] items-center justify-center rounded bg-white/10 text-6xl sm:text-7xl" />
      )}
      <span className="text-sm font-bold uppercase tracking-widest text-white/80 sm:text-base">
        {team?.name ?? "—"}
      </span>
    </div>
  );
}

/** Score + match clock, read live off the feed's Score/Clock/StatusId fields (§4). */
export function MatchStatusBar({ fixture, matchState }: { fixture: FixtureTheme | null; matchState: MatchState }) {
  const { display: clock, seconds } = useInterpolatedClock(matchState);
  const annotation = getClockAnnotation(matchState.phase, seconds, matchState.clockRunning);

  return (
    <div className="mx-4 mt-5 flex items-center justify-center gap-4 sm:gap-8">
      <TeamColumn team={fixture?.participant1} align="left" />

      <div className="flex flex-col items-center leading-none">
        <span className="text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
          {matchState.participant1Goals}–{matchState.participant2Goals}
        </span>
        <span className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/45">
          {matchState.phase === "H1" || matchState.phase === "H2" ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
          ) : null}
          {clock ?? "--:--"} · {PHASE_LABEL[matchState.phase]}
        </span>
        {annotation && (
          <span className="mt-1.5 rounded-full bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
            {annotation}
          </span>
        )}
      </div>

      <TeamColumn team={fixture?.participant2} align="right" />
    </div>
  );
}
