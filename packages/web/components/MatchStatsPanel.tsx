import type { FixtureTheme, MatchStats } from "@final-third/shared";

function StatRow({ label, p1, p2, highlight }: { label: string; p1: number; p2: number; highlight?: boolean }) {
  const total = p1 + p2;
  const p1Pct = total > 0 ? (p1 / total) * 100 : 50;
  const p2Pct = total > 0 ? (p2 / total) * 100 : 50;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`tabular-nums font-bold ${highlight ? "text-white" : "text-white/70"}`}>{p1}</span>
        <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
        <span className={`tabular-nums font-bold ${highlight ? "text-white" : "text-white/70"}`}>{p2}</span>
      </div>
      <div className="flex h-1 gap-0.5 overflow-hidden rounded-full">
        <div
          className="rounded-full bg-blue-500/60 transition-all duration-700"
          style={{ width: `${p1Pct}%` }}
        />
        <div
          className="rounded-full bg-red-500/60 transition-all duration-700"
          style={{ width: `${p2Pct}%` }}
        />
      </div>
    </div>
  );
}

function PossessionRow({ p1, p2 }: { p1: number; p2: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="tabular-nums font-bold text-white">{p1}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/40">Possession</span>
        <span className="tabular-nums font-bold text-white">{p2}%</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <div
          className="rounded-full bg-blue-500/70 transition-all duration-700"
          style={{ width: `${p1}%` }}
        />
        <div
          className="rounded-full bg-red-500/70 transition-all duration-700"
          style={{ width: `${p2}%` }}
        />
      </div>
    </div>
  );
}

export function MatchStatsPanel({
  stats,
  fixture,
}: {
  stats: MatchStats;
  fixture: FixtureTheme | null;
}) {
  const hasActivity = stats.shots[0] + stats.shots[1] > 0 ||
    stats.corners[0] + stats.corners[1] > 0 ||
    stats.possession[0] !== 50;

  if (!hasActivity) return null;

  return (
    <div className="mx-4 rounded-xl bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          {fixture?.participant1.name ?? "Home"}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">
          Match Stats
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
          {fixture?.participant2.name ?? "Away"}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        <PossessionRow p1={stats.possession[0]} p2={stats.possession[1]} />
        <StatRow label="Shots" p1={stats.shots[0]} p2={stats.shots[1]} />
        <StatRow label="On Target" p1={stats.shotsOnTarget[0]} p2={stats.shotsOnTarget[1]} />
        <StatRow label="Corners" p1={stats.corners[0]} p2={stats.corners[1]} />
        <StatRow label="Fouls" p1={stats.fouls[0]} p2={stats.fouls[1]} />
        <StatRow label="Yellow Cards" p1={stats.yellowCards[0]} p2={stats.yellowCards[1]} highlight />
        {(stats.redCards[0] > 0 || stats.redCards[1] > 0) && (
          <StatRow label="Red Cards" p1={stats.redCards[0]} p2={stats.redCards[1]} highlight />
        )}
      </div>
    </div>
  );
}
