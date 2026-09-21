import { randomUUID } from "node:crypto";
import type { Response } from "express";
import {
  EMPTY_MATCH_STATE,
  getKnownFixture,
  getTeamTheme,
  readMatchState,
  type FixtureTheme,
  type GuessRequest,
  type LullGuessRequest,
  type LullRoundView,
  type MatchState,
  type MatchStats,
  type PlayerGuess,
  type Round,
  type RoundView,
  type ScoreMessage,
  type ServerEvent,
} from "@final-third/shared";
import type { FeedSource } from "./feed/FeedSource.js";
import { ReplaySource } from "./feed/ReplaySource.js";
import { RoundEngine } from "./engine/roundEngine.js";
import { gradeGuess } from "./engine/gradeGuess.js";
import type { LeaderboardStore } from "./store/LeaderboardStore.js";
import { SyntheticOddsTicker } from "./oddsTicker.js";

const LULL_THRESHOLD_MS = 90_000;
const TICK_INTERVAL_MS = 250;
const ODDS_REFRESH_MS = Number(process.env.ODDS_REFRESH_MS ?? 90_000);
const PUSH_THRESHOLD_PP = 0.5;


/**
 * One live match room: owns the FeedSource -> RoundEngine pipeline, fans out
 * events to connected SSE clients, and grades/persists guesses. This is the
 * "relay" in the architecture (§5) — the browser only ever talks to this class
 * over SSE + REST; it never sees the TxLINE connection or API token.
 */
export class GameRoom {
  private readonly engine: RoundEngine;
  private readonly connections = new Map<string, Response>();
  private readonly guessesByRound = new Map<string, Map<string, PlayerGuess>>();
  private tickTimer: NodeJS.Timeout | null = null;
  private lastRoundEndedAt = 0;
  private matchState: MatchState = EMPTY_MATCH_STATE;
  private participant1IsHome: boolean | null = null;
  private readonly oddsTicker: SyntheticOddsTicker;
  private lullRound: LullRoundView | null = null;
  private readonly lullGuesses = new Map<string, LullGuessRequest>();
  private lullRoundCounter = 0;
  private possessionCount: [number, number] = [0, 0];
  private shotCount: [number, number] = [0, 0];
  private shotOnTargetCount: [number, number] = [0, 0];
  private foulCount: [number, number] = [0, 0];

  constructor(
    public readonly fixtureId: string,
    private readonly feed: FeedSource,
    private readonly leaderboard: LeaderboardStore,
    feedSpeed = 1
  ) {
    this.engine = new RoundEngine(fixtureId, feedSpeed);
    this.oddsTicker = new SyntheticOddsTicker(ODDS_REFRESH_MS, (pct) => this.onOddsRefresh(pct));
  }

  start(): void {
    this.feed.start((msg) => {
      if (this.participant1IsHome === null && typeof msg.Participant1IsHome === "boolean") {
        this.participant1IsHome = msg.Participant1IsHome;
      }
      this.updateMatchState(msg);
      const events = this.engine.processMessage(msg);
      this.handleEngineEvents(events);
    });
    this.tickTimer = setInterval(() => {
      const events = this.engine.tick(this.feed.now());
      this.handleEngineEvents(events);
      this.maybeOpenLullRound();
    }, TICK_INTERVAL_MS);
    this.oddsTicker.start();
  }

  stop(): void {
    this.feed.stop();
    this.oddsTicker.stop();
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  /**
   * Real fixture pulls carry `Participant1IsHome` on every message (confirmed against
   * actual data — see FEEDBACK.md), so once one has arrived we know the true mapping
   * rather than assuming it. Falls back to the conventional "Participant1 == home"
   * assumption (matching KNOWN_FIXTURES' layout) until the first real message arrives,
   * or for synthetic fixtures which don't carry the flag at all.
   */
  getFixtureTheme(): FixtureTheme {
    const known = getKnownFixture(this.fixtureId.replace(/^synthetic-/, ""));
    const participant1IsHome = this.participant1IsHome ?? true;
    const participant1Name = participant1IsHome ? known?.home : known?.away;
    const participant2Name = participant1IsHome ? known?.away : known?.home;
    return {
      fixtureId: this.fixtureId,
      participant1: getTeamTheme(participant1Name),
      participant2: getTeamTheme(participant2Name),
    };
  }

  /** Register a new SSE connection; returns its playerId (generated) and sends `hello`. */
  addConnection(res: Response, existingPlayerId?: string): string {
    const playerId = existingPlayerId ?? randomUUID();
    this.connections.set(playerId, res);
    this.send(playerId, { type: "hello", playerId, fixture: this.getFixtureTheme() });
    this.send(playerId, { type: "match_state", state: this.matchState });

    if (this.isMainRoundActive()) {
      const current = this.engine.getCurrentRound()!;
      this.send(playerId, { type: "round_open", round: this.toRoundView(current) });
      if (current.status === "locked") {
        this.send(playerId, { type: "round_lock", round: this.toRoundView(current) });
      }
    }
    if (this.lullRound) {
      this.send(playerId, { type: "lull_round_open", round: this.lullRound });
    }
    return playerId;
  }

  removeConnection(playerId: string): void {
    this.connections.delete(playerId);
  }

  async submitGuess(req: GuessRequest): Promise<{ ok: true } | { ok: false; error: string }> {
    const round = this.engine.getCurrentRound();
    if (!round || round.id !== req.roundId) {
      return { ok: false, error: "No matching open round for this guess." };
    }
    const byRound = this.guessesByRound.get(round.id) ?? new Map<string, PlayerGuess>();
    if (byRound.has(req.playerId)) {
      return { ok: false, error: "Already guessed this round." };
    }
    byRound.set(req.playerId, {
      roundId: round.id,
      side: req.side,
      submittedTs: this.feed.now(),
    });
    this.guessesByRound.set(round.id, byRound);
    return { ok: true };
  }

  async submitLullGuess(req: LullGuessRequest): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.lullRound || this.lullRound.id !== req.roundId) {
      return { ok: false, error: "No matching open lull round for this guess." };
    }
    if (this.lullGuesses.has(req.playerId)) {
      return { ok: false, error: "Already guessed this lull round." };
    }
    this.lullGuesses.set(req.playerId, req);
    return { ok: true };
  }

  /**
   * Replay-only: jump the feed to just before the next ATTACK/DEFENSE chance.
   * Refuses while a duel round is open/locked so the player isn't yanked mid-call.
   */
  skipToNextDanger(): { ok: true } | { ok: false; error: string } {
    if (!(this.feed instanceof ReplaySource)) {
      return { ok: false, error: "Jump ahead is only available in replay." };
    }
    if (this.isMainRoundActive()) {
      return { ok: false, error: "Finish this call first." };
    }
    // Drop lull without a resolve event — the client clears on a successful skip,
    // and the next duel arrives within the lead-in window.
    this.lullRound = null;
    this.lullGuesses.clear();
    if (!this.feed.skipToNextDanger()) {
      return { ok: false, error: "No upcoming chance to call." };
    }
    // Keep lull from reopening during the short lead-in before the next trigger.
    this.lastRoundEndedAt = this.feed.now();
    return { ok: true };
  }

  async getLeaderboard(limit?: number) {
    return this.leaderboard.getLeaderboard(this.fixtureId, limit);
  }

  async getStreak(playerId: string) {
    return this.leaderboard.getStreak(this.fixtureId, playerId);
  }

  /** Everything the share card (§6) needs in one call: streak, accuracy, percentile, theme. */
  async getShareData(playerId: string) {
    const [streak, accuracy] = await Promise.all([
      this.leaderboard.getStreak(this.fixtureId, playerId),
      this.leaderboard.getAccuracy(this.fixtureId, playerId),
    ]);
    const beatPercent = await this.leaderboard.getPercentileBeaten(this.fixtureId, streak.best);
    const accuracyPct = accuracy.total > 0 ? Math.round((accuracy.wins / accuracy.total) * 100) : 0;

    return {
      fixture: this.getFixtureTheme(),
      streak: streak.current,
      best: streak.best,
      accuracy: accuracyPct,
      beatPercent,
    };
  }

  // -------------------------------------------------------------------------

  private handleEngineEvents(events: ReturnType<RoundEngine["tick"]>): void {
    for (const event of events) {
      switch (event.type) {
        case "round_open":
          this.lastRoundEndedAt = 0;
          this.cancelLullRound();
          this.broadcast({ type: "round_open", round: this.toRoundView(event.round) });
          break;
        case "round_lock":
          this.broadcast({ type: "round_lock", round: this.toRoundView(event.round) });
          break;
        case "round_resolve":
          this.lastRoundEndedAt = this.feed.now();
          this.broadcast({ type: "round_resolve", round: this.toRoundView(event.round) });
          void this.gradeAndPersist(event.round);
          break;
        case "round_void":
          this.lastRoundEndedAt = this.feed.now();
          this.broadcast({ type: "round_void", round: this.toRoundView(event.round), reason: event.reason });
          void this.gradeAndPersist(event.round);
          break;
        case "heartbeat":
          this.broadcast({ type: "heartbeat", ts: event.ts, participant: event.participant, action: event.action });
          break;
        case "reliability_pause":
          this.broadcast({ type: "reliability_pause", ts: event.ts, reason: event.reason });
          break;
        case "reliability_resume":
          this.broadcast({ type: "reliability_resume", ts: event.ts });
          break;
      }
    }
  }

  private async gradeAndPersist(round: Round): Promise<void> {
    const guesses = this.guessesByRound.get(round.id);
    if (!guesses) return;
    for (const [playerId, guess] of guesses) {
      const grade = gradeGuess(round, guess);
      // PASS (didn't tap in time) leaves the streak untouched, same as VOID.
      const streak =
        grade.grade === "WIN" || grade.grade === "LOSS"
          ? await this.leaderboard.recordOutcome(this.fixtureId, playerId, grade.grade === "WIN")
          : await this.leaderboard.getStreak(this.fixtureId, playerId);
      this.send(playerId, { type: "guess_result", result: grade, streak });
    }
    this.guessesByRound.delete(round.id);
  }

  private updateMatchState(msg: ScoreMessage): void {
    const next = readMatchState(msg, this.matchState);

    const participant = (msg as Record<string, unknown>).Participant as number | undefined;
    const action = msg.Action;
    const data = (msg as Record<string, unknown>).Data as Record<string, unknown> | undefined;

    if (participant === 1 || participant === 2) {
      const idx = participant === 1 ? 0 : 1;
      if (action.includes("possession")) {
        this.possessionCount[idx]++;
      }
      if (action === "shot" && data?.Outcome) {
        this.shotCount[idx]++;
        const outcome = data.Outcome as string;
        if (outcome === "OnTarget" || outcome === "Scored") {
          this.shotOnTargetCount[idx]++;
        }
      }
      if (action === "free_kick" && msg.Confirmed && data?.FreeKickType !== "Offside") {
        this.foulCount[idx === 0 ? 1 : 0]++;
      }
    }

    const totalPoss = this.possessionCount[0] + this.possessionCount[1];
    const possession: [number, number] = totalPoss > 0
      ? [Math.round((this.possessionCount[0] / totalPoss) * 100), Math.round((this.possessionCount[1] / totalPoss) * 100)]
      : [50, 50];

    next.stats = {
      ...next.stats,
      possession,
      shots: [...this.shotCount] as [number, number],
      shotsOnTarget: [...this.shotOnTargetCount] as [number, number],
      fouls: [...this.foulCount] as [number, number],
    };

    this.matchState = next;
    this.broadcast({ type: "match_state", state: next });
  }

  /**
   * Lull fallback (§3): once no danger phase has triggered for 90+ seconds, or
   * during half-time, offer an odds higher/lower round instead of leaving the
   * screen idle. Never opens while a real duel round is in flight.
   */
  private maybeOpenLullRound(): void {
    if (this.isMainRoundActive() || this.lullRound) return;

    const sinceLastRoundMs = this.lastRoundEndedAt === 0 ? 0 : this.feed.now() - this.lastRoundEndedAt;
    const isHalftime = this.matchState.phase === "HT";
    if (sinceLastRoundMs < LULL_THRESHOLD_MS && !isHalftime) return;

    this.lullRoundCounter += 1;
    const openPct = this.oddsTicker.getPct();
    const round: LullRoundView = {
      id: `${this.fixtureId}-lull${this.lullRoundCounter}`,
      fixtureId: this.fixtureId,
      marketLabel: this.oddsTicker.getMarketLabel(),
      openPct,
      openedTs: this.feed.now(),
      refreshDeadlineRealMs: Date.now() + ODDS_REFRESH_MS,
    };
    this.lullRound = round;
    this.broadcast({ type: "lull_round_open", round });
  }

  /** Cancel an in-flight lull round with no grade effect (used when a real duel round preempts it). */
  private cancelLullRound(): void {
    if (!this.lullRound) return;
    const round = this.lullRound;
    this.lullRound = null;
    this.lullGuesses.clear();
    this.broadcast({ type: "lull_round_resolve", round, closePct: round.openPct });
  }

  /** Odds refresh (§2: every ~1-2 min): resolves any open lull round, then lets a new one open on the next tick. */
  private onOddsRefresh(closePct: number): void {
    if (!this.lullRound) return;
    const round = this.lullRound;
    this.lullRound = null;
    const guesses = new Map(this.lullGuesses);
    this.lullGuesses.clear();

    this.broadcast({ type: "lull_round_resolve", round, closePct });

    const delta = closePct - round.openPct;
    const isPush = Math.abs(delta) < PUSH_THRESHOLD_PP;

    void (async () => {
      for (const [playerId, guess] of guesses) {
        const correct = !isPush && ((delta > 0 && guess.side === "HIGHER") || (delta < 0 && guess.side === "LOWER"));
        const grade = isPush ? "PUSH" : correct ? "WIN" : "LOSS";
        const streak = isPush
          ? await this.leaderboard.getStreak(this.fixtureId, playerId)
          : await this.leaderboard.recordOutcome(this.fixtureId, playerId, correct);
        this.send(playerId, {
          type: "lull_guess_result",
          result: { roundId: round.id, side: guess.side, grade, openPct: round.openPct, closePct },
          streak,
        });
      }
    })();
  }

  /** `engine.getCurrentRound()` keeps returning the last round object after it resolves/voids — check status, not truthiness. */
  private isMainRoundActive(): boolean {
    const current = this.engine.getCurrentRound();
    return current !== null && (current.status === "open" || current.status === "locked");
  }

  private toRoundView(round: Round): RoundView {
    return {
      id: round.id,
      fixtureId: round.fixtureId,
      attacker: round.attacker,
      defender: round.defender,
      triggerAction: round.triggerAction,
      triggerTs: round.triggerTs,
      lockDeadlineTs: round.lockDeadlineTs,
      lockDeadlineRealMs: Date.now() + this.feed.realMsUntil(round.lockDeadlineTs),
      status: round.status,
      outcome: round.outcome,
      resolvedTs: round.resolvedTs,
    };
  }

  private send(playerId: string, event: ServerEvent): void {
    const res = this.connections.get(playerId);
    if (!res) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  private broadcast(event: ServerEvent): void {
    for (const playerId of this.connections.keys()) this.send(playerId, event);
  }
}
