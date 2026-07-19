"use client";

import { motion } from "framer-motion";
import type { LullGuessSide, LullRoundView } from "@final-third/shared";
import type { LullReveal } from "@/lib/useGameStream";

/** Odds-fallback round (§3): shown during quiet spells or half-time instead of a dead screen. */
export function LullRoundCard({
  round,
  myGuess,
  reveal,
  onGuess,
}: {
  round: LullRoundView | null;
  myGuess: LullGuessSide | null;
  reveal: LullReveal | null;
  onGuess: (side: LullGuessSide) => void;
}) {
  if (reveal) {
    const { result } = reveal;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 px-6 py-5 text-center"
      >
        <p className="text-xs uppercase tracking-widest text-white/40">{reveal.round.marketLabel}</p>
        <p className="text-2xl font-black tabular-nums">
          {reveal.round.openPct.toFixed(1)}% → {(result?.closePct ?? reveal.round.openPct).toFixed(1)}%
        </p>
        {result && (
          <p
            className={`text-sm font-semibold uppercase tracking-widest ${
              result.grade === "WIN" ? "text-emerald-400" : result.grade === "LOSS" ? "text-red-400" : "text-white/50"
            }`}
          >
            {reveal.myGuess ? `You called ${reveal.myGuess}` : "No pick"} — {result.grade}
          </p>
        )}
      </motion.div>
    );
  }

  if (!round) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 px-6 py-5"
    >
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-white/40">Quiet spell — market call</p>
        <p className="mt-1 text-base text-white/85">
          {round.marketLabel}: <span className="font-bold tabular-nums">{round.openPct.toFixed(1)}%</span>
        </p>
        <p className="mt-1 text-xs text-white/40">Where does it move by the next refresh?</p>
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <button
          onClick={() => onGuess("HIGHER")}
          disabled={myGuess !== null}
          className={`flex-1 rounded-xl border-2 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
            myGuess === "HIGHER" ? "border-emerald-400 text-emerald-400" : "border-white/15 text-white/70"
          } ${myGuess !== null && myGuess !== "HIGHER" ? "opacity-40" : ""}`}
        >
          Higher
        </button>
        <button
          onClick={() => onGuess("LOWER")}
          disabled={myGuess !== null}
          className={`flex-1 rounded-xl border-2 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
            myGuess === "LOWER" ? "border-red-400 text-red-400" : "border-white/15 text-white/70"
          } ${myGuess !== null && myGuess !== "LOWER" ? "opacity-40" : ""}`}
        >
          Lower
        </button>
      </div>
    </motion.div>
  );
}
