import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RoundEngineEvent, ScoreMessage } from "@final-third/shared";
import { RoundEngine } from "../src/engine/roundEngine.js";
import { gradeGuess } from "../src/engine/gradeGuess.js";
import { ReplaySource } from "../src/feed/ReplaySource.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNTHETIC_FIXTURE = path.resolve(__dirname, "../../../data/raw/synthetic-18237038.jsonl");

/** Runs every message from a fixture through a fresh engine and collects all events. */
async function replayThroughEngine(filePath: string): Promise<RoundEngineEvent[]> {
  const messages = await ReplaySource.load(filePath);
  const engine = new RoundEngine("test-fixture");
  const events: RoundEngineEvent[] = [];
  for (const msg of messages) {
    events.push(...engine.processMessage(msg));
  }
  // Flush any round still open/locked past the last message by ticking well past the timeout.
  const lastTs = messages.length ? messages[messages.length - 1].Ts : 0;
  events.push(...engine.tick(lastTs + 61_000));
  return events;
}

describe("RoundEngine against the synthetic fixture (§2 sanity check)", () => {
  it("produces ~60 rounds with an approximately 50/50 attacker split", async () => {
    const events = await replayThroughEngine(SYNTHETIC_FIXTURE);
    const opens = events.filter((e) => e.type === "round_open");

    // A handful of phases legitimately collapse into their predecessor when jitter
    // causes overlap (§3.1), so we expect "~60", not exactly 60.
    expect(opens.length).toBeGreaterThanOrEqual(55);
    expect(opens.length).toBeLessThanOrEqual(65);

    const byAttacker = { 1: 0, 2: 0 };
    for (const e of opens) {
      if (e.type !== "round_open") continue;
      byAttacker[e.round.attacker]++;
    }
    // Collapsed phases can nudge the split by a round or two off dead-even.
    expect(Math.abs(byAttacker[1] - byAttacker[2])).toBeLessThanOrEqual(3);
  });

  it("never opens a second round while one is unresolved (collapses overlapping danger signals)", async () => {
    const messages = await ReplaySource.load(SYNTHETIC_FIXTURE);
    const engine = new RoundEngine("test-fixture");
    let openRounds = 0;

    for (const msg of messages) {
      for (const event of engine.processMessage(msg)) {
        if (event.type === "round_open") {
          openRounds++;
          expect(openRounds).toBe(1); // never opens while another is unresolved
        }
        if (event.type === "round_resolve" || event.type === "round_void") {
          openRounds = 0;
        }
      }
    }
  });

  it("matches the documented outcome-tier distribution within tolerance", async () => {
    const events = await replayThroughEngine(SYNTHETIC_FIXTURE);
    const resolves = events.filter((e) => e.type === "round_resolve");
    const voids = events.filter((e) => e.type === "round_void");
    const total = resolves.length + voids.length;

    const counts: Record<string, number> = {};
    for (const e of resolves) {
      if (e.type !== "round_resolve") continue;
      counts[e.outcome] = (counts[e.outcome] ?? 0) + 1;
    }
    counts["VOID"] = voids.length;

    const pct = (tier: string) => ((counts[tier] ?? 0) / total) * 100;

    expect(pct("DEFENSE_CLEAN")).toBeGreaterThan(35);
    expect(pct("DEFENSE_CLEAN")).toBeLessThan(58);
    expect(pct("SHOT") + pct("CORNER")).toBeGreaterThan(25);
    expect(pct("GOAL") + pct("PENALTY")).toBeLessThan(12);
  });

  it("locks rounds 4s after trigger and voids after 60s with no resolution", () => {
    const engine = new RoundEngine("timeout-fixture");
    const trigger: ScoreMessage = { Action: "danger_possession", Participant: 1, Ts: 0, Confirmed: true };
    const openEvents = engine.processMessage(trigger);
    expect(openEvents.some((e) => e.type === "round_open")).toBe(true);

    const lockEvents = engine.tick(4_000);
    expect(lockEvents.some((e) => e.type === "round_lock")).toBe(true);

    const voidEvents = engine.tick(60_000);
    expect(voidEvents.some((e) => e.type === "round_void")).toBe(true);
  });

  it("resolves on the first matching event per §3.3 ordering", () => {
    const engine = new RoundEngine("resolve-fixture");
    engine.processMessage({ Action: "danger_possession", Participant: 1, Ts: 0, Confirmed: true });
    const events = engine.processMessage({ Action: "corner", Participant: 1, Ts: 2_000, Confirmed: true });
    const resolve = events.find((e) => e.type === "round_resolve");
    expect(resolve?.type).toBe("round_resolve");
    if (resolve?.type === "round_resolve") {
      expect(resolve.outcome).toBe("CORNER");
      expect(resolve.winningSide).toBe("ATTACK");
    }
  });

  it("ignores resolving events with Confirmed === false", () => {
    const engine = new RoundEngine("unconfirmed-fixture");
    engine.processMessage({ Action: "danger_possession", Participant: 1, Ts: 0, Confirmed: true });
    const events = engine.processMessage({ Action: "shot", Participant: 1, Ts: 1_000, Confirmed: false });
    expect(events.some((e) => e.type === "round_resolve")).toBe(false);
  });

  it("pauses new-round triggers while an unreliable_* guard is active", () => {
    const engine = new RoundEngine("guard-fixture");
    engine.processMessage({ Action: "unreliable_corners", Ts: 0, Unreliable: true });
    const events = engine.processMessage({ Action: "danger_possession", Participant: 1, Ts: 1_000, Confirmed: true });
    expect(events.some((e) => e.type === "round_open")).toBe(false);

    engine.processMessage({ Action: "unreliable_corners", Ts: 2_000, Reliable: true });
    const resumedEvents = engine.processMessage({
      Action: "danger_possession",
      Participant: 1,
      Ts: 3_000,
      Confirmed: true,
    });
    expect(resumedEvents.some((e) => e.type === "round_open")).toBe(true);
  });
});

describe("gradeGuess", () => {
  it("grades a correct attack pick as WIN and flags jackpots on goals", () => {
    const round = {
      id: "r1",
      fixtureId: "f",
      attacker: 1 as const,
      defender: 2 as const,
      triggerAction: "danger_possession",
      triggerTs: 0,
      lockDeadlineTs: 4_000,
      status: "resolved" as const,
      outcome: "GOAL" as const,
      resolvedTs: 5_000,
    };
    const grade = gradeGuess(round, { roundId: "r1", side: "ATTACK", submittedTs: 1_000 });
    expect(grade.grade).toBe("WIN");
    expect(grade.jackpot).toBe(true);
  });

  it("passes a guess submitted after the lock deadline", () => {
    const round = {
      id: "r1",
      fixtureId: "f",
      attacker: 1 as const,
      defender: 2 as const,
      triggerAction: "danger_possession",
      triggerTs: 0,
      lockDeadlineTs: 4_000,
      status: "resolved" as const,
      outcome: "GOAL" as const,
      resolvedTs: 5_000,
    };
    const grade = gradeGuess(round, { roundId: "r1", side: "ATTACK", submittedTs: 4_500 });
    expect(grade.grade).toBe("PASS");
  });

  it("voids a guess on a voided round", () => {
    const round = {
      id: "r1",
      fixtureId: "f",
      attacker: 1 as const,
      defender: 2 as const,
      triggerAction: "danger_possession",
      triggerTs: 0,
      lockDeadlineTs: 4_000,
      status: "voided" as const,
    };
    const grade = gradeGuess(round, { roundId: "r1", side: "DEFENSE", submittedTs: 1_000 });
    expect(grade.grade).toBe("VOID");
  });
});
