import {
  IS_JACKPOT,
  WINNING_SIDE,
  type GradedGuess,
  type PlayerGuess,
  type Round,
} from "@final-third/shared";

/** Pure grading function: a round + a guess -> WIN/LOSS/PASS/VOID. No I/O, no clock reads. */
export function gradeGuess(round: Round, guess: PlayerGuess): GradedGuess {
  if (guess.submittedTs > round.lockDeadlineTs) {
    return { roundId: round.id, side: guess.side, outcome: "PENDING", grade: "PASS", jackpot: false };
  }

  if (round.status === "voided") {
    return { roundId: round.id, side: guess.side, outcome: "TIMED_OUT", grade: "VOID", jackpot: false };
  }

  if (round.status !== "resolved" || !round.outcome) {
    return { roundId: round.id, side: guess.side, outcome: "PENDING", grade: "PASS", jackpot: false };
  }

  const winner = WINNING_SIDE[round.outcome];
  const jackpot = IS_JACKPOT[round.outcome];

  if (winner === null) {
    return { roundId: round.id, side: guess.side, outcome: round.outcome, grade: "VOID", jackpot };
  }

  return {
    roundId: round.id,
    side: guess.side,
    outcome: round.outcome,
    grade: winner === guess.side ? "WIN" : "LOSS",
    jackpot,
  };
}
