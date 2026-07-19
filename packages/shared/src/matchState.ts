import { STATUS_ID, type MatchPhase, type MatchState, type MatchStats, type ScoreMessage } from "./types.js";

function statusIdToPhase(statusId: number | undefined): MatchPhase {
  switch (statusId) {
    case STATUS_ID.SCHEDULED:
      return "SCHEDULED";
    case STATUS_ID.FIRST_HALF:
      return "H1";
    case STATUS_ID.HALF_TIME:
      return "HT";
    case STATUS_ID.SECOND_HALF:
      return "H2";
    case STATUS_ID.FULL_TIME:
    case STATUS_ID.FINALISED:
      return "FT";
    case STATUS_ID.EXTRA_TIME_1:
    case STATUS_ID.EXTRA_TIME_2:
      return "ET";
    case STATUS_ID.PENALTIES:
      return "PENS";
    default:
      return "UNKNOWN";
  }
}

function formatClock(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Reads the running score/clock/phase off whatever a message happens to carry. Any
 * message can carry these — not just goal events — so callers should call this on
 * every message and keep whichever fields are present, falling back to the previous
 * state for the rest.
 *
 * `Score` and `Clock` shapes here are confirmed against real fixture pulls (not the
 * spec text's description) — see FEEDBACK.md. `Score` is keyed by period
 * ("H1"/"HT"/"H2"/"Total") under "Participant1"/"Participant2", not by participant
 * number directly; `Clock` is `{ Running, Seconds }`, not a pre-formatted string.
 */
export function readMatchState(msg: ScoreMessage, prev: MatchState): MatchState {
  const p1Goals = msg.Score?.Participant1?.Total?.Goals;
  const p2Goals = msg.Score?.Participant2?.Total?.Goals;

  const stats = { ...prev.stats };
  const p1Total = msg.Score?.Participant1?.Total;
  const p2Total = msg.Score?.Participant2?.Total;
  if (p1Total || p2Total) {
    stats.corners = [p1Total?.Corners ?? stats.corners[0], p2Total?.Corners ?? stats.corners[1]];
    stats.yellowCards = [p1Total?.YellowCards ?? stats.yellowCards[0], p2Total?.YellowCards ?? stats.yellowCards[1]];
    stats.redCards = [p1Total?.RedCards ?? stats.redCards[0], p2Total?.RedCards ?? stats.redCards[1]];
  }

  return {
    participant1Goals: p1Goals ?? prev.participant1Goals,
    participant2Goals: p2Goals ?? prev.participant2Goals,
    clock: msg.Clock ? formatClock(msg.Clock.Seconds) : prev.clock,
    phase: msg.StatusId !== undefined ? statusIdToPhase(msg.StatusId) : prev.phase,
    clockSeconds: msg.Clock ? msg.Clock.Seconds : prev.clockSeconds,
    clockRunning: msg.Clock ? msg.Clock.Running : prev.clockRunning,
    clockUpdatedAtMs: msg.Clock ? Date.now() : prev.clockUpdatedAtMs,
    stats,
  };
}

export const EMPTY_MATCH_STATS: MatchStats = {
  possession: [50, 50],
  shots: [0, 0],
  shotsOnTarget: [0, 0],
  corners: [0, 0],
  yellowCards: [0, 0],
  redCards: [0, 0],
  fouls: [0, 0],
};

export const EMPTY_MATCH_STATE: MatchState = {
  participant1Goals: 0,
  participant2Goals: 0,
  clock: null,
  phase: "UNKNOWN",
  clockSeconds: null,
  clockRunning: false,
  clockUpdatedAtMs: null,
  stats: { ...EMPTY_MATCH_STATS },
};
