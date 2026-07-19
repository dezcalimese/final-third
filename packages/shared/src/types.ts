/**
 * Shared types for the TxLINE scores feed messages and the Final Third
 * round engine. Field names mirror the raw feed payload exactly (§4 of spec)
 * so the engine can consume parsed JSON with no remapping.
 */

export type Participant = 1 | 2;

/** Lowercase snake_case Action values observed on the TxLINE scores feed. */
export type ScoreAction =
  | "safe_possession"
  | "attack_possession"
  | "danger_possession"
  | "high_danger_possession"
  | "possession"
  | "shot"
  | "corner"
  | "goal"
  | "penalty"
  | "penalty_outcome"
  | "free_kick"
  | "goal_kick"
  | "unreliable_corners"
  | "unreliable_yellow_cards"
  | "suspend"
  | string; // feed is not a closed enum; keep it open

/** One period's cumulative line (per real fixture data — see FEEDBACK.md). */
export interface ScoreLine {
  Corners?: number;
  Goals?: number;
  YellowCards?: number;
  RedCards?: number;
}

/** Confirmed against real fixture pulls: keyed by period, not by participant. */
export interface PeriodScore {
  H1?: ScoreLine;
  HT?: ScoreLine;
  H2?: ScoreLine;
  ET1?: ScoreLine;
  ET2?: ScoreLine;
  Pens?: ScoreLine;
  Total?: ScoreLine;
}

export interface ScoreMessage {
  Action: ScoreAction;
  Participant?: Participant;
  Ts: number;
  Seq?: number;
  Id?: string | number;
  Confirmed?: boolean;
  StatusId?: number;
  /** Confirmed against real fixture pulls: an object, not a formatted string. */
  Clock?: { Running: boolean; Seconds: number };
  /** Confirmed against real fixture pulls: keyed "Participant1"/"Participant2", not "1"/"2". */
  Score?: { Participant1?: PeriodScore; Participant2?: PeriodScore };
  Stats?: Record<string, unknown>;
  /** Present on every message in real pulls — which participant number is home. */
  Participant1IsHome?: boolean;
  /**
   * Per spec text, unreliable_corners / unreliable_yellow_cards / suspend messages
   * should carry these — real pulls show `suspend` firing as a bare momentary event
   * with neither field present (see FEEDBACK.md). Kept for spec-compliance; the
   * reliability guard also auto-clears on a timeout since there's no observed
   * explicit "cleared" signal in real data.
   */
  Unreliable?: boolean;
  Reliable?: boolean;
  [key: string]: unknown;
}

/**
 * StatusId → match phase. 1/2/3/4/5/100 confirmed against real fixture pulls
 * (scheduled/H1/HT/H2/full-time/finalised); 7/9/12 are spec text, unobserved (neither
 * real fixture went to extra time or penalties).
 */
export const STATUS_ID = {
  SCHEDULED: 1,
  FIRST_HALF: 2,
  HALF_TIME: 3,
  SECOND_HALF: 4,
  FULL_TIME: 5,
  EXTRA_TIME_1: 7,
  EXTRA_TIME_2: 9,
  PENALTIES: 12,
  FINALISED: 100,
} as const;

// ---------------------------------------------------------------------------
// Round engine domain types
// ---------------------------------------------------------------------------

export type RoundOutcomeTier =
  | "DEFENSE_CLEAN"
  | "SHOT"
  | "CORNER"
  | "GOAL"
  | "PENALTY"
  | "FREEKICK_ATT"
  | "VOID";

export type RoundSide = "ATTACK" | "DEFENSE";

/** Which side wins the pick for a given resolved outcome tier. Void has no winner. */
export const WINNING_SIDE: Record<RoundOutcomeTier, RoundSide | null> = {
  DEFENSE_CLEAN: "DEFENSE",
  SHOT: "ATTACK",
  CORNER: "ATTACK",
  GOAL: "ATTACK",
  PENALTY: "ATTACK",
  FREEKICK_ATT: "ATTACK",
  VOID: null,
};

/** Whether an outcome tier is a "jackpot" grade for celebratory/heartbreak flair. */
export const IS_JACKPOT: Record<RoundOutcomeTier, boolean> = {
  DEFENSE_CLEAN: false,
  SHOT: false,
  CORNER: false,
  GOAL: true,
  PENALTY: true,
  FREEKICK_ATT: false,
  VOID: false,
};

export interface Round {
  id: string;
  fixtureId: string;
  /** Team (Participant) applying pressure — the ATTACK side of the duel. */
  attacker: Participant;
  defender: Participant;
  triggerAction: ScoreAction;
  triggerTs: number;
  /** Ts by which a tap must land to count (triggerTs + 4000). */
  lockDeadlineTs: number;
  status: "open" | "locked" | "resolved" | "voided";
  outcome?: RoundOutcomeTier;
  resolvedTs?: number;
  resolvingMessage?: ScoreMessage;
}

export type RoundEngineEvent =
  | { type: "round_open"; round: Round }
  | { type: "round_lock"; round: Round }
  | { type: "round_resolve"; round: Round; outcome: RoundOutcomeTier; winningSide: RoundSide | null }
  | { type: "round_void"; round: Round; reason: "timeout" | "no_signal" }
  | { type: "heartbeat"; ts: number; participant?: Participant; action: ScoreAction }
  | { type: "reliability_pause"; ts: number; reason: string }
  | { type: "reliability_resume"; ts: number };

export interface PlayerGuess {
  roundId: string;
  side: RoundSide;
  /** Wall-clock ms when the guess was submitted; used only to check it beat the lock deadline. */
  submittedTs: number;
}

export type GuessGrade = "WIN" | "LOSS" | "PASS" | "VOID";

export interface GradedGuess {
  roundId: string;
  side: RoundSide | null;
  outcome: RoundOutcomeTier | "TIMED_OUT" | "PENDING";
  grade: GuessGrade;
  jackpot: boolean;
}

// ---------------------------------------------------------------------------
// Team theming
// ---------------------------------------------------------------------------

export interface TeamTheme {
  /** ISO 3166-1 alpha-2 code, lowercase, for the flag-icons `fi fi-xx` class. */
  iso: string;
  name: string;
  primary: string;
  secondary: string;
}

// ---------------------------------------------------------------------------
// Wire protocol (relay <-> browser over SSE + REST)
// ---------------------------------------------------------------------------

/**
 * Client-safe projection of a Round — omits the raw resolvingMessage feed payload.
 *
 * `triggerTs`/`lockDeadlineTs` are in the feed's own time domain (real match-time ms),
 * which only equals wall-clock ms when the relay is replaying at 1x speed. Faster dev
 * speeds compress that domain, so the client must never diff it against its own
 * Date.now(). `lockDeadlineRealMs` is the relay's translation of the lock deadline into
 * actual wall-clock epoch ms at broadcast time — that's what the UI countdown should use.
 */
export interface RoundView {
  id: string;
  fixtureId: string;
  attacker: Participant;
  defender: Participant;
  triggerAction: ScoreAction;
  triggerTs: number;
  lockDeadlineTs: number;
  lockDeadlineRealMs: number;
  status: Round["status"];
  outcome?: RoundOutcomeTier;
  resolvedTs?: number;
}

export interface FixtureTheme {
  fixtureId: string;
  /**
   * Keyed by the feed's own Participant numbers (1|2), not "home"/"away" — Round.attacker
   * and Round.defender are Participant numbers, so this is directly indexable by them
   * with no separate home/away mapping to keep straight.
   */
  participant1: TeamTheme;
  participant2: TeamTheme;
}

/** One match a player can choose to join, for the pre-game match-selector screen. */
export interface AvailableFixture extends FixtureTheme {
  label: string;
  isLive: boolean;
}

/** Match phase derived from StatusId (§4 STATUS_ID table). */
export type MatchPhase = "SCHEDULED" | "H1" | "HT" | "H2" | "FT" | "ET" | "PENS" | "UNKNOWN";

/** Live score + clock, read off the running Score/Clock/StatusId fields on every message. */
export interface MatchState {
  participant1Goals: number;
  participant2Goals: number;
  clock: string | null;
  phase: MatchPhase;
  clockSeconds: number | null;
  clockRunning: boolean;
  clockUpdatedAtMs: number | null;
}

export type ServerEvent =
  | { type: "hello"; playerId: string; fixture: FixtureTheme }
  | { type: "round_open"; round: RoundView }
  | { type: "round_lock"; round: RoundView }
  | { type: "round_resolve"; round: RoundView }
  | { type: "round_void"; round: RoundView; reason: "timeout" | "no_signal" }
  | { type: "heartbeat"; ts: number; participant?: Participant; action: ScoreAction }
  | { type: "reliability_pause"; ts: number; reason: string }
  | { type: "reliability_resume"; ts: number }
  | { type: "guess_result"; result: GradedGuess; streak: PlayerStreak }
  | { type: "match_state"; state: MatchState }
  | { type: "lull_round_open"; round: LullRoundView }
  | { type: "lull_round_resolve"; round: LullRoundView; closePct: number }
  | { type: "lull_guess_result"; result: LullGradedGuess; streak: PlayerStreak };

export interface GuessRequest {
  playerId: string;
  roundId: string;
  side: RoundSide;
}

// ---------------------------------------------------------------------------
// Lull fallback rounds (§3 "Lull fallback (secondary round type)")
// ---------------------------------------------------------------------------

export type LullGuessSide = "HIGHER" | "LOWER";

export interface LullRoundView {
  id: string;
  fixtureId: string;
  /** e.g. "Over 2.5 Goals" or "France to Win" — whichever market is active. */
  marketLabel: string;
  openPct: number;
  openedTs: number;
  refreshDeadlineRealMs: number;
}

export interface LullGuessRequest {
  playerId: string;
  roundId: string;
  side: LullGuessSide;
}

export interface LullGradedGuess {
  roundId: string;
  side: LullGuessSide;
  grade: "WIN" | "LOSS" | "PUSH";
  openPct: number;
  closePct: number;
}

export interface PlayerStreak {
  current: number;
  best: number;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName?: string;
  bestStreak: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Odds (lull fallback)
// ---------------------------------------------------------------------------

export interface OddsMessage {
  FixtureId: string | number;
  SuperOddsType:
    | "1X2_PARTICIPANT_RESULT"
    | "OVERUNDER_PARTICIPANT_GOALS"
    | "ASIANHANDICAP_PARTICIPANT_GOALS"
    | string;
  Prices: Record<string, number>; // decimal odds x1000
  Pct: Record<string, string>; // demarginalized pct as string, sometimes "NA"
  MarketParameters?: { line?: number; [k: string]: unknown };
  MarketPeriod?: string;
  Ts?: number;
}
