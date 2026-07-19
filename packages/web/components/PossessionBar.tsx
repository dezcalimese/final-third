"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { FixtureTheme } from "@final-third/shared";
import type { PossessionMoment } from "@/lib/useGameStream";

const TIER_INTENSITY: Record<PossessionMoment["tier"], number> = {
  safe: 0.18,
  attack: 0.4,
  danger: 0.72,
  high_danger: 1,
};

/**
 * The constant heartbeat (§6): ~640 possession messages/match drive this bar so the
 * screen is never static, independent of whether a duel round is active.
 */
export function PossessionBar({
  fixture,
  possession,
}: {
  fixture: FixtureTheme | null;
  possession: PossessionMoment | null;
}) {
  const reduceMotion = useReducedMotion();
  const home = fixture?.participant1;
  const away = fixture?.participant2;

  const side = possession?.participant === 2 ? "away" : "home";
  const intensity = possession ? TIER_INTENSITY[possession.tier] : 0.15;
  // 50 = dead center; pushes toward whichever side currently has the ball, scaled by danger tier.
  const markerPct = 50 + (side === "home" ? -1 : 1) * intensity * 42;

  const glowColor = side === "home" ? home?.primary ?? "#2563EB" : away?.primary ?? "#F59E0B";

  return (
    <div className="w-full px-4 pt-3">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ background: `linear-gradient(90deg, ${home?.primary ?? "#2563EB"}55, transparent)` }}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/2"
          style={{ background: `linear-gradient(270deg, ${away?.primary ?? "#F59E0B"}55, transparent)` }}
        />
        <motion.div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
          animate={{
            left: `${markerPct}%`,
            boxShadow: `0 0 ${8 + intensity * 22}px ${2 + intensity * 6}px ${glowColor}`,
            backgroundColor: glowColor,
          }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18 }}
          style={{ marginLeft: -8 }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] uppercase tracking-widest text-white/50">
        <span>{home?.name ?? "Home"}</span>
        <span>{away?.name ?? "Away"}</span>
      </div>
    </div>
  );
}
