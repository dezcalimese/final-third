"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AvailableFixture } from "@final-third/shared";
import Link from "next/link";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

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

export function MatchPicker({ onSelect }: { onSelect: (fixtureId: string) => void }) {
  const [fixtures, setFixtures] = useState<AvailableFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(new URL("/api/fixtures", RELAY_URL).toString())
      .then((r) => r.json())
      .then((data) => {
        setFixtures(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <h1 className="mb-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Final Third</h1>
      <p className="mb-10 max-w-md text-center text-sm text-white/50">
        Pick a recorded match and replay from kickoff — call ATTACK or DEFENSE when danger
        phases fire and build your streak.
      </p>

      {loading ? (
        <p className="text-sm text-white/30">Loading matches…</p>
      ) : fixtures.length === 0 ? (
        <p className="text-sm text-white/30">No matches available. Start the relay server first.</p>
      ) : (
        <div className="flex w-full max-w-lg flex-col gap-4">
          {fixtures.map((f) => (
            <motion.button
              key={f.fixtureId}
              onClick={() => onSelect(f.fixtureId)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative rounded-2xl border border-white/8 bg-white/5 px-5 py-5 text-left backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/8"
            >
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">{isoToFlagEmoji(f.participant1.iso)}</span>
                  <span className="text-sm font-bold uppercase tracking-wider text-white/80">
                    {f.participant1.name}
                  </span>
                </div>

                <span className="text-xs font-semibold text-white/25">v</span>

                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold uppercase tracking-wider text-white/80">
                    {f.participant2.name}
                  </span>
                  <span className="text-3xl">{isoToFlagEmoji(f.participant2.iso)}</span>
                </div>
              </div>

              <div className="absolute right-4 top-3 flex flex-col items-end">
                {f.isLive ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Replay</span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <Link
        href="/docs"
        className="mt-12 text-[11px] font-semibold uppercase tracking-widest text-white/25 hover:text-white/50"
      >
        Technical Docs &rarr;
      </Link>
    </div>
  );
}
