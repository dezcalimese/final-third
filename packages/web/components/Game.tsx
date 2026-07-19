"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { useGameStream } from "@/lib/useGameStream";
import { PossessionBar } from "./PossessionBar";
import { DuelStage } from "./DuelStage";
import { StreakBadge } from "./StreakBadge";
import { WalletConnectButton } from "./WalletConnectButton";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { MatchStatusBar } from "./MatchStatusBar";
import { ShareCardModal } from "./ShareCardModal";

const SoccerBallField = dynamic(() => import("./SoccerBallField").then((m) => m.SoccerBallField), { ssr: false });

export function Game() {
  const { user } = usePrivy();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const {
    status,
    playerId,
    fixture,
    round,
    myGuess,
    possession,
    streak,
    reveal,
    reliabilityPaused,
    matchState,
    lullRound,
    lullGuess,
    lullReveal,
    submitGuess,
    submitLullGuess,
  } = useGameStream(user?.wallet?.address ?? null);

  const escalationTint =
    round?.status === "locked" && fixture
      ? (round.attacker === 2 ? fixture.participant2 : fixture.participant1).primary
      : null;

  // Danger/high-danger possession nudges the ambient ball drift a little faster —
  // a texture-only cue, never anything shake-like (accessibility decision, §6).
  const ballSpeed = round?.status === "locked" ? 1.6 : possession?.tier === "high_danger" ? 1.35 : 1;

  return (
    <>
      {reduceMotion ? (
        <div className="pointer-events-none fixed inset-0 -z-10 bg-pitch-950" />
      ) : (
        <SoccerBallField speedMultiplier={ballSpeed} />
      )}
      <motion.main
        className="relative mx-auto flex min-h-screen max-w-xl flex-col"
        animate={{
          background: escalationTint
            ? `radial-gradient(circle at 50% 0%, ${escalationTint}40, transparent 65%)`
            : "radial-gradient(circle at 50% 0%, #0f231833, transparent 65%)",
        }}
        transition={{ duration: 1.1 }}
      >
        <header className="flex items-center justify-between px-5 pt-5">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Final Third</span>
          <WalletConnectButton />
        </header>

        <div className="flex flex-1 flex-col justify-between gap-8 py-6">
          <MatchStatusBar fixture={fixture} matchState={matchState} />

          <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
            <DuelStage
              fixture={fixture}
              round={round}
              myGuess={myGuess}
              reveal={reveal}
              possession={possession}
              reliabilityPaused={reliabilityPaused}
              onGuess={submitGuess}
              lullRound={lullRound}
              lullGuess={lullGuess}
              lullReveal={lullReveal}
              onLullGuess={submitLullGuess}
            />
          </section>

          <PossessionBar fixture={fixture} possession={possession} />
        </div>

        <footer className="flex items-center justify-between px-5 pb-6">
          <StreakBadge streak={streak} />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/70"
            >
              Share
            </button>
            <button
              onClick={() => setLeaderboardOpen(true)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/70"
            >
              Leaderboard
            </button>
            <span className="text-[10px] uppercase tracking-widest text-white/30">
              {status === "open" ? "Live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
            </span>
          </div>
        </footer>

        <LeaderboardPanel playerId={playerId} open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
        <ShareCardModal playerId={playerId} open={shareOpen} onClose={() => setShareOpen(false)} />
      </motion.main>
    </>
  );
}
