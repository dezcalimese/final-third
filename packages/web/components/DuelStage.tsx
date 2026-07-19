"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FixtureTheme, LullGuessSide, LullRoundView, RoundSide, RoundView } from "@final-third/shared";
import type { LullReveal, PossessionMoment, Reveal } from "@/lib/useGameStream";
import { useNow } from "@/lib/useNow";
import { TeamBadge } from "./TeamBadge";
import { LullRoundCard } from "./LullRoundCard";

const LOCK_WINDOW_MS = 4_000;
const SIEGE_MAX_MS = 45_000; // beyond this, escalation intensity caps out

const OUTCOME_COPY: Record<string, string> = {
  DEFENSE_CLEAN: "Defense clears it.",
  SHOT: "Shot away!",
  CORNER: "Won a corner!",
  GOAL: "GOAL!",
  PENALTY: "PENALTY!",
  FREEKICK_ATT: "Free kick won.",
};

function idleCopy(fixture: FixtureTheme | null, possession: PossessionMoment | null): string {
  if (!fixture) return "Connecting to the match…";
  if (!possession) return "Waiting for the first spell of pressure…";
  const team = possession.participant === 2 ? fixture.participant2 : fixture.participant1;
  if (possession.tier === "high_danger" || possession.tier === "danger") {
    return `${team.name} are pressing dangerously…`;
  }
  if (possession.tier === "attack") return `${team.name} building an attack…`;
  return `${team.name} in possession.`;
}

export function DuelStage({
  fixture,
  round,
  myGuess,
  reveal,
  possession,
  reliabilityPaused,
  onGuess,
  lullRound,
  lullGuess,
  lullReveal,
  onLullGuess,
}: {
  fixture: FixtureTheme | null;
  round: RoundView | null;
  myGuess: RoundSide | null;
  reveal: Reveal | null;
  possession: PossessionMoment | null;
  reliabilityPaused: boolean;
  onGuess: (side: RoundSide) => void;
  lullRound: LullRoundView | null;
  lullGuess: LullGuessSide | null;
  lullReveal: LullReveal | null;
  onLullGuess: (side: LullGuessSide) => void;
}) {
  const reduceMotion = useReducedMotion();
  const now = useNow(120);

  if (reveal && reveal.round.status !== "open") {
    return <RevealCard fixture={fixture} reveal={reveal} />;
  }

  if (!round || round.status !== "open" && round.status !== "locked") {
    if (lullRound || lullReveal) {
      return <LullRoundCard round={lullRound} myGuess={lullGuess} reveal={lullReveal} onGuess={onLullGuess} />;
    }
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-medium text-white/80">{idleCopy(fixture, possession)}</p>
        {reliabilityPaused && (
          <p className="text-xs uppercase tracking-widest text-amber-400/80">
            Feed reliability check — new rounds paused
          </p>
        )}
      </div>
    );
  }

  const attackTeam = round.attacker === 2 ? fixture?.participant2 : fixture?.participant1;
  const defenseTeam = round.defender === 2 ? fixture?.participant2 : fixture?.participant1;
  const isLocked = round.status === "locked";

  // Derived from the locally-ticking `now` (120ms interval, same as siegeElapsed
  // below), not a value computed from Date.now() in the parent on every render — the
  // parent only re-renders on state changes (a heartbeat, a round event), which is
  // too infrequent to drive a smooth countdown.
  const msRemaining = isLocked ? 0 : Math.max(0, round.lockDeadlineRealMs - now);
  const lockProgress = 1 - Math.min(1, msRemaining / LOCK_WINDOW_MS);

  const siegeElapsed = isLocked ? Math.max(0, now - round.lockDeadlineRealMs) : 0;
  const siegeIntensity = Math.min(1, siegeElapsed / SIEGE_MAX_MS);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-7 px-2">
      <p className="text-center text-lg font-medium text-white/85 sm:text-xl">
        {attackTeam?.name ?? "Attack"} are building… who wins this one?
      </p>

      <div className="flex w-full max-w-lg items-stretch gap-4">
        <DuelButton
          side="ATTACK"
          team={attackTeam}
          selected={myGuess === "ATTACK"}
          disabled={isLocked}
          locked={isLocked}
          onClick={() => onGuess("ATTACK")}
        />
        <DuelButton
          side="DEFENSE"
          team={defenseTeam}
          selected={myGuess === "DEFENSE"}
          disabled={isLocked}
          locked={isLocked}
          onClick={() => onGuess("DEFENSE")}
        />
      </div>

      {!isLocked ? (
        <div className="flex w-full max-w-lg flex-col items-center gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-white/70"
              initial={{ width: "0%" }}
              animate={{ width: `${lockProgress * 100}%` }}
              transition={reduceMotion ? { duration: 0 } : { ease: "linear", duration: 0.12 }}
            />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest tabular-nums text-white/50">
            {(msRemaining / 1000).toFixed(1)}s to pick
          </span>
        </div>
      ) : (
        <motion.p
          className="text-xs uppercase tracking-widest"
          animate={{
            color: siegeIntensity > 0.5 ? "#f87171" : "#f4f7f5aa",
            opacity: [0.6, 1, 0.6],
          }}
          transition={{ duration: 1.1, repeat: reduceMotion ? 0 : Infinity }}
        >
          {myGuess ? `Locked in on ${myGuess}` : "Locked — no pick"} · holding on…
        </motion.p>
      )}
    </div>
  );
}

function DuelButton({
  side,
  team,
  selected,
  disabled,
  locked,
  onClick,
}: {
  side: RoundSide;
  team: { iso: string; name: string; primary: string; secondary: string } | undefined;
  selected: boolean;
  disabled: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const primary = team?.primary ?? "#2563EB";
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      animate={{
        borderColor: selected ? primary : "rgba(255,255,255,0.15)",
        boxShadow: selected ? `0 0 24px 2px ${primary}66` : "0 0 0px 0px transparent",
      }}
      className={`relative flex flex-1 flex-col items-center gap-3 rounded-3xl border-2 px-4 py-7 backdrop-blur-md transition-colors sm:py-9 ${
        locked && !selected ? "opacity-40" : ""
      } ${disabled ? "cursor-default" : "cursor-pointer active:brightness-110"}`}
      style={{ background: `linear-gradient(180deg, ${primary}22, rgba(255,255,255,0.03))` }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">{side}</span>
      {team ? <TeamBadge team={team} size="lg" /> : <span className="text-sm">—</span>}
      {selected && locked && (
        <span className="absolute -top-2 right-2 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-black">
          PINNED
        </span>
      )}
    </motion.button>
  );
}

function RevealCard({ fixture, reveal }: { fixture: FixtureTheme | null; reveal: Reveal }) {
  const outcome = reveal.round.outcome;
  const jackpot = outcome === "GOAL" || outcome === "PENALTY";
  const grade = reveal.result?.grade;
  const voided = reveal.round.status === "voided";

  const attackTeam = reveal.round.attacker === 2 ? fixture?.participant2 : fixture?.participant1;
  const primary = attackTeam?.primary ?? "#2563EB";

  const gradeColor =
    grade === "WIN" ? "#4ade80" : grade === "LOSS" ? "#f87171" : grade === "PASS" ? "#9ca3af" : "#facc15";

  return (
    <motion.div
      key={reveal.round.id}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: jackpot ? 0.5 : 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex min-h-[220px] flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl px-6 py-8 text-center"
      style={{
        background: jackpot
          ? `radial-gradient(circle at 50% 20%, ${primary}55, rgba(5,11,8,0.9))`
          : "rgba(255,255,255,0.03)",
      }}
    >
      {jackpot && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{ background: primary }}
        />
      )}
      <p className={`relative font-black tracking-tight ${jackpot ? "text-4xl" : "text-2xl"}`}>
        {voided ? "Too close to call" : OUTCOME_COPY[outcome ?? ""] ?? "Round over"}
      </p>
      {reveal.result && (
        <p className="relative text-sm font-semibold uppercase tracking-widest" style={{ color: gradeColor }}>
          You called {reveal.result.side} — {grade}
        </p>
      )}
      {!reveal.result && reveal.myGuess === null && (
        <p className="relative text-sm text-white/50">No pick this time.</p>
      )}
      {!reveal.result && reveal.myGuess !== null && !voided && (
        <p className="relative text-sm text-white/50">Grading…</p>
      )}
    </motion.div>
  );
}
