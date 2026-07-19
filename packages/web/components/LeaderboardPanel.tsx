"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardEntry } from "@final-third/shared";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** Async per-match leaderboard (§1, §5): best streak per player on this fixture, via Redis ZREVRANGE. */
export function LeaderboardPanel({ playerId, open, onClose }: { playerId: string | null; open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(new URL("/api/leaderboard", RELAY_URL).toString())
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-t-3xl bg-pitch-900 p-5 sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/70">This match</h2>
              <button onClick={onClose} className="text-xs text-white/40">
                Close
              </button>
            </div>
            {!entries && <p className="py-6 text-center text-sm text-white/40">Loading…</p>}
            {entries && entries.length === 0 && (
              <p className="py-6 text-center text-sm text-white/40">No streaks yet — be the first.</p>
            )}
            <ul className="flex flex-col gap-1.5">
              {entries?.map((e) => (
                <li
                  key={e.playerId}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    e.playerId === playerId ? "bg-white/10 font-semibold" : "bg-white/[0.03]"
                  }`}
                >
                  <span className="text-white/60">
                    #{e.rank} <span className="text-white/90">{shortId(e.playerId)}</span>
                  </span>
                  <span className="tabular-nums">{e.bestStreak}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
