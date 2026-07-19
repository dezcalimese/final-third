import { WINNING_SIDE, type Participant, type Round, type RoundEngineEvent, type RoundOutcomeTier, type ScoreMessage } from "@final-third/shared";

const LOCK_WINDOW_MS = 4_000;
const TIMEOUT_MS = 60_000;
const RELIABILITY_GUARD_ACTIONS = new Set(["unreliable_corners", "unreliable_yellow_cards", "suspend"]);
const DANGER_ACTIONS = new Set(["danger_possession", "high_danger_possession"]);
/**
 * Spec text says unreliable_corners / unreliable_yellow_cards / suspend messages
 * carry an Unreliable/Reliable flag signaling when the interruption clears. Real
 * fixture pulls show `suspend` firing as a bare momentary event with neither field
 * present (see FEEDBACK.md) — so alongside honoring an explicit Reliable:true if one
 * ever arrives, the guard also auto-clears after this long with no further
 * guard-action message, treating each occurrence as a brief coverage interruption
 * rather than an indefinite pause.
 */
const RELIABILITY_AUTO_RESUME_MS = 10_000;

/**
 * Pure, deterministic round-lifecycle core (§3, §5). Consumes normalized ScoreMessages
 * (and periodic clock ticks, since lock/timeout are wall-clock deadlines even during
 * quiet spells with no incoming messages) and emits round open/lock/resolve/void events.
 *
 * No network, no timers, no randomness — every deadline check is driven by an explicit
 * timestamp input, so this can be replayed deterministically against a recorded fixture
 * in a unit test.
 */
export class RoundEngine {
  private currentRound: Round | null = null;
  private reliabilityPaused = false;
  private reliabilityPausedAtTs: number | null = null;
  private roundCounter = 0;
  private nowTs = 0;

  constructor(private readonly fixtureId: string) {}

  /** Advance the engine's notion of "now" without a message (e.g. a 250ms server tick). */
  tick(ts: number): RoundEngineEvent[] {
    this.nowTs = Math.max(this.nowTs, ts);
    return [...this.checkReliabilityTimeout(), ...this.checkDeadlines()];
  }

  /** Feed one normalized score message through the engine in stream order. */
  processMessage(msg: ScoreMessage): RoundEngineEvent[] {
    this.nowTs = Math.max(this.nowTs, msg.Ts);
    const events: RoundEngineEvent[] = [];

    events.push(...this.applyReliabilityGuard(msg));
    events.push(...this.checkReliabilityTimeout());

    if (this.currentRound && this.isOpenOrLocked(this.currentRound)) {
      // A round is in flight: try to resolve it, collapse any further danger signals
      // into it (no new round while one is unresolved), then re-check deadlines.
      const resolveEvents = this.tryResolve(msg);
      events.push(...resolveEvents);

      if (this.currentRound && this.isOpenOrLocked(this.currentRound) && DANGER_ACTIONS.has(msg.Action)) {
        events.push({
          type: "heartbeat",
          ts: msg.Ts,
          participant: msg.Participant,
          action: msg.Action,
        });
      }

      events.push(...this.checkDeadlines());
      return events;
    }

    // No round in flight: any possession message is ambient heartbeat for the UI.
    events.push({ type: "heartbeat", ts: msg.Ts, participant: msg.Participant, action: msg.Action });

    events.push(...this.tryTrigger(msg));
    return events;
  }

  getCurrentRound(): Round | null {
    return this.currentRound;
  }

  // -------------------------------------------------------------------------

  private isOpenOrLocked(round: Round): boolean {
    return round.status === "open" || round.status === "locked";
  }

  private applyReliabilityGuard(msg: ScoreMessage): RoundEngineEvent[] {
    if (!RELIABILITY_GUARD_ACTIONS.has(msg.Action)) return [];

    const explicitlyReliable = msg.Reliable === true || msg.Unreliable === false;
    const explicitlyUnreliable = msg.Unreliable === true || msg.Reliable === false;
    // Real fixture pulls show `suspend` firing with neither field present at all —
    // treat that bare event the same as an explicit "unreliable" signal.
    const bareEvent = msg.Unreliable === undefined && msg.Reliable === undefined;

    if (explicitlyReliable) {
      if (!this.reliabilityPaused) return [];
      this.reliabilityPaused = false;
      this.reliabilityPausedAtTs = null;
      return [{ type: "reliability_resume", ts: msg.Ts }];
    }

    if (explicitlyUnreliable || bareEvent) {
      this.reliabilityPausedAtTs = msg.Ts;
      if (this.reliabilityPaused) return [];
      this.reliabilityPaused = true;
      return [{ type: "reliability_pause", ts: msg.Ts, reason: msg.Action }];
    }

    return [];
  }

  /** Auto-clears a reliability pause after RELIABILITY_AUTO_RESUME_MS with no further guard-action message. */
  private checkReliabilityTimeout(): RoundEngineEvent[] {
    if (!this.reliabilityPaused || this.reliabilityPausedAtTs === null) return [];
    if (this.nowTs - this.reliabilityPausedAtTs < RELIABILITY_AUTO_RESUME_MS) return [];
    this.reliabilityPaused = false;
    this.reliabilityPausedAtTs = null;
    return [{ type: "reliability_resume", ts: this.nowTs }];
  }

  private tryTrigger(msg: ScoreMessage): RoundEngineEvent[] {
    if (this.reliabilityPaused) return [];
    if (!DANGER_ACTIONS.has(msg.Action)) return [];
    if (msg.Confirmed === false) return [];
    if (msg.Participant !== 1 && msg.Participant !== 2) return [];

    const attacker = msg.Participant as Participant;
    const defender: Participant = attacker === 1 ? 2 : 1;

    this.roundCounter += 1;
    const round: Round = {
      id: `${this.fixtureId}-r${this.roundCounter}`,
      fixtureId: this.fixtureId,
      attacker,
      defender,
      triggerAction: msg.Action,
      triggerTs: msg.Ts,
      lockDeadlineTs: msg.Ts + LOCK_WINDOW_MS,
      status: "open",
    };
    this.currentRound = round;
    return [{ type: "round_open", round }];
  }

  private tryResolve(msg: ScoreMessage): RoundEngineEvent[] {
    const round = this.currentRound;
    if (!round) return [];
    if (msg.Confirmed === false) return [];

    const outcome = this.matchOutcome(msg, round.attacker);
    if (!outcome) return [];

    round.status = "resolved";
    round.outcome = outcome;
    round.resolvedTs = msg.Ts;
    round.resolvingMessage = msg;

    return [{ type: "round_resolve", round, outcome, winningSide: WINNING_SIDE[outcome] }];
  }

  /** First matching rule wins, in the exact order specified in §3.3. */
  private matchOutcome(msg: ScoreMessage, attacker: Participant): RoundOutcomeTier | null {
    const defender: Participant = attacker === 1 ? 2 : 1;

    if (msg.Action === "goal") return "GOAL";
    if (msg.Action === "penalty" || msg.Action === "penalty_outcome") return "PENALTY";
    if (msg.Action === "shot" && msg.Confirmed !== false) return "SHOT";
    if (msg.Action === "corner") return "CORNER";
    if (msg.Action === "free_kick" && msg.Participant === attacker) return "FREEKICK_ATT";
    if (msg.Action === "safe_possession" && msg.Participant === defender) return "DEFENSE_CLEAN";
    if (msg.Action === "goal_kick") return "DEFENSE_CLEAN";
    if ((msg.Action === "possession" || msg.Action === "attack_possession") && msg.Participant === defender) {
      return "DEFENSE_CLEAN";
    }
    return null;
  }

  private checkDeadlines(): RoundEngineEvent[] {
    const round = this.currentRound;
    if (!round) return [];
    const events: RoundEngineEvent[] = [];

    if (round.status === "open" && this.nowTs >= round.lockDeadlineTs) {
      round.status = "locked";
      events.push({ type: "round_lock", round });
    }

    if (this.isOpenOrLocked(round) && this.nowTs - round.triggerTs >= TIMEOUT_MS) {
      round.status = "voided";
      events.push({ type: "round_void", round, reason: "timeout" });
    }

    return events;
  }
}
