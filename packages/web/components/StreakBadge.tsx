"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PlayerStreak } from "@final-third/shared";

/** Streak reset must sting visibly (§6) — a sharp red flash + scale-down, never a shake. */
export function StreakBadge({ streak }: { streak: PlayerStreak }) {
  const reduceMotion = useReducedMotion();
  const prevCurrent = useRef(streak.current);
  const [justReset, setJustReset] = useState(false);

  useEffect(() => {
    if (prevCurrent.current > 0 && streak.current === 0) {
      setJustReset(true);
      const t = setTimeout(() => setJustReset(false), 500);
      return () => clearTimeout(t);
    }
    prevCurrent.current = streak.current;
  }, [streak.current]);

  return (
    <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 backdrop-blur-md">
      <motion.div
        key={streak.current}
        initial={reduceMotion ? false : { scale: justReset ? 1.15 : 0.85, opacity: 0.4 }}
        animate={{
          scale: 1,
          opacity: 1,
          color: justReset ? "#ef4444" : "#f4f7f5",
        }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="text-2xl font-black tabular-nums"
      >
        {streak.current}
      </motion.div>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-widest text-white/50">Streak</div>
        <div className="text-[11px] text-white/40">Best {streak.best}</div>
      </div>
    </div>
  );
}
