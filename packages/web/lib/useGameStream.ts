"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_MATCH_STATE } from "@final-third/shared";
import type {
  FixtureTheme,
  GradedGuess,
  LullGradedGuess,
  LullGuessSide,
  LullRoundView,
  MatchState,
  Participant,
  PlayerStreak,
  RoundSide,
  RoundView,
  ServerEvent,
} from "@final-third/shared";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

export interface PossessionMoment {
  participant: Participant;
  tier: "safe" | "attack" | "danger" | "high_danger";
  ts: number;
}

export interface Reveal {
  round: RoundView;
  myGuess: RoundSide | null;
  result: GradedGuess | null;
}

export interface LullReveal {
  round: LullRoundView;
  myGuess: LullGuessSide | null;
  result: LullGradedGuess | null;
}

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "error";

function tierFromAction(action: string): PossessionMoment["tier"] {
  if (action === "high_danger_possession") return "high_danger";
  if (action === "danger_possession") return "danger";
  if (action === "attack_possession") return "attack";
  return "safe";
}

/**
 * `walletIdentity`: once the player connects a Solana wallet, pass its base58 pubkey
 * here. The hook drops the anonymous session connection and reconnects using the
 * pubkey as the playerId, so the wallet becomes the persistent identity for
 * leaderboard/streak purposes (§5) — before that, identity is a server-issued id that
 * only lives for the current session (no browser storage, per §9).
 */
export function useGameStream(walletIdentity?: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [fixture, setFixture] = useState<FixtureTheme | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const [myGuess, setMyGuess] = useState<RoundSide | null>(null);
  const [possession, setPossession] = useState<PossessionMoment | null>(null);
  const [streak, setStreak] = useState<PlayerStreak>({ current: 0, best: 0 });
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [reliabilityPaused, setReliabilityPaused] = useState(false);
  const [matchState, setMatchState] = useState<MatchState>(EMPTY_MATCH_STATE);
  const [lullRound, setLullRound] = useState<LullRoundView | null>(null);
  const [lullGuess, setLullGuess] = useState<LullGuessSide | null>(null);
  const [lullReveal, setLullReveal] = useState<LullReveal | null>(null);

  const playerIdRef = useRef<string | null>(null);
  const roundRef = useRef<RoundView | null>(null);
  const myGuessRef = useRef<RoundSide | null>(null);
  const lullGuessRef = useRef<LullGuessSide | null>(null);
  const lullRoundRef = useRef<LullRoundView | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const url = new URL("/api/stream", RELAY_URL);
    if (playerIdRef.current) url.searchParams.set("playerId", playerIdRef.current);

    const es = new EventSource(url.toString());
    esRef.current = es;
    setStatus((s) => (s === "open" ? s : "connecting"));

    es.onopen = () => setStatus("open");

    es.onerror = () => {
      setStatus("reconnecting");
    };

    es.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as ServerEvent;

      switch (event.type) {
        case "hello":
          playerIdRef.current = event.playerId;
          setPlayerId(event.playerId);
          setFixture(event.fixture);
          break;
        case "round_open":
          roundRef.current = event.round;
          myGuessRef.current = null;
          setRound(event.round);
          setMyGuess(null);
          setReveal(null);
          // A duel round always preempts a lull round (server cancels it first) — clear
          // any stale lull state so it can't block the duel cards from rendering.
          lullRoundRef.current = null;
          setLullRound(null);
          setLullReveal(null);
          break;
        case "lull_round_open":
          lullGuessRef.current = null;
          lullRoundRef.current = event.round;
          setLullRound(event.round);
          setLullGuess(null);
          setLullReveal(null);
          // A lull round only ever opens while no duel round/reveal is active, but clear
          // any stale duel reveal defensively so it can't shadow the lull round UI.
          setReveal(null);
          break;
        case "lull_round_resolve":
          setLullReveal((prev) => prev ?? { round: event.round, myGuess: lullGuessRef.current, result: null });
          lullRoundRef.current = null;
          setLullRound(null);
          break;
        case "lull_guess_result":
          setStreak(event.streak);
          // Always arrives right after lull_round_resolve for the same round (§gameRoom
          // onOddsRefresh broadcasts resolve, then sends this per-player synchronously),
          // so `prev` is already seeded — this only no-ops on a very unlucky reconnect.
          setLullReveal((prev) => (prev ? { ...prev, myGuess: lullGuessRef.current, result: event.result } : prev));
          break;
        case "round_lock":
          roundRef.current = event.round;
          setRound(event.round);
          break;
        case "round_resolve":
        case "round_void": {
          roundRef.current = event.round;
          setRound(event.round);
          // guess_result arrives separately (server-graded); pre-seed the reveal so the
          // UI can show the outcome immediately even before the personalized grade lands.
          setReveal((prev) => prev ?? { round: event.round, myGuess: myGuessRef.current, result: null });
          break;
        }
        case "heartbeat":
          if (event.participant) {
            setPossession({ participant: event.participant, tier: tierFromAction(event.action), ts: event.ts });
          }
          break;
        case "reliability_pause":
          setReliabilityPaused(true);
          break;
        case "reliability_resume":
          setReliabilityPaused(false);
          break;
        case "guess_result":
          setStreak(event.streak);
          setReveal((prev) => ({
            round: prev?.round ?? roundRef.current!,
            myGuess: myGuessRef.current,
            result: event.result,
          }));
          break;
        case "match_state":
          setMatchState(event.state);
          break;
      }
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);

  // Reconnect under the wallet pubkey once the player signs up (§5): server treats
  // the new SSE connection's `playerId` query param as the identity going forward.
  useEffect(() => {
    if (!walletIdentity || walletIdentity === playerIdRef.current) return;
    playerIdRef.current = walletIdentity;
    esRef.current?.close();
    connect();
  }, [walletIdentity, connect]);

  const submitGuess = useCallback(async (side: RoundSide) => {
    const currentRound = roundRef.current;
    const pid = playerIdRef.current;
    if (!currentRound || !pid) return { ok: false as const, error: "Not connected yet." };
    if (currentRound.status !== "open") return { ok: false as const, error: "Round already locked." };

    myGuessRef.current = side;
    setMyGuess(side);

    const res = await fetch(new URL("/api/guess", RELAY_URL).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: pid, roundId: currentRound.id, side }),
    });
    return (await res.json()) as { ok: boolean; error?: string };
  }, []);

  const submitLullGuess = useCallback(async (side: LullGuessSide) => {
    const currentLullRound = lullRoundRef.current;
    const pid = playerIdRef.current;
    if (!currentLullRound || !pid) return { ok: false as const, error: "Not connected yet." };

    lullGuessRef.current = side;
    setLullGuess(side);

    const res = await fetch(new URL("/api/lull-guess", RELAY_URL).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: pid, roundId: currentLullRound.id, side }),
    });
    return (await res.json()) as { ok: boolean; error?: string };
  }, []);

  return {
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
  };
}
