import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScoreMessage } from "@final-third/shared";

/**
 * Generates a SYNTHETIC fixture that matches every measured parameter in spec §2
 * as closely as a small generator can: ~60 danger phases, exact 50/50 attacker
 * split, the documented outcome-tier distribution, the documented bimodal
 * resolution-timing percentiles, ~186 danger signals/match, ~640 possession
 * messages/match total. Also carries a running Score/Clock/StatusId on every
 * message so the score/clock UI has something real to track.
 *
 * This exists ONLY because TXLINE_API_TOKEN is not available in this build
 * environment to pull the real fixtures. It is clearly labeled synthetic and is
 * not a substitute for running `npm run fetch:historical` against the real feed
 * before the July 19 data window closes. The round engine is unit-tested against
 * this file as a sanity check (§7 step 2), and it doubles as a ReplaySource fixture
 * for local development.
 */

// Deterministic PRNG (mulberry32) so the generated fixture is reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(18237038);

type Tier = "DEFENSE_CLEAN" | "SHOT" | "CORNER" | "GOAL" | "PENALTY" | "FREEKICK_ATT" | "VOID";

const TIER_WEIGHTS: [Tier, number][] = [
  ["DEFENSE_CLEAN", 0.47],
  ["SHOT", 0.22],
  ["CORNER", 0.17],
  ["GOAL", 0.04],
  ["PENALTY", 0.01],
  ["FREEKICK_ATT", 0.03],
  ["VOID", 0.06],
];

function pickTier(): Tier {
  const r = rand();
  let cumulative = 0;
  for (const [tier, weight] of TIER_WEIGHTS) {
    cumulative += weight;
    if (r <= cumulative) return tier;
  }
  return "DEFENSE_CLEAN";
}

/** Piecewise-linear inverse-CDF sampler matching the five measured percentiles (§2). */
const PERCENTILE_ANCHORS: [number, number][] = [
  [0, 0.5],
  [0.25, 3.8],
  [0.5, 7.2],
  [0.75, 18.3],
  [0.9, 36.3],
  [1.0, 58.9],
];

function sampleResolutionDelaySec(): number {
  const p = rand();
  for (let i = 1; i < PERCENTILE_ANCHORS.length; i++) {
    const [p0, v0] = PERCENTILE_ANCHORS[i - 1];
    const [p1, v1] = PERCENTILE_ANCHORS[i];
    if (p <= p1) {
      const frac = (p - p0) / (p1 - p0);
      return v0 + frac * (v1 - v0);
    }
  }
  return 58.9;
}

const PHASE_COUNT = 60;
const DANGER_SIGNALS_PER_PHASE_AVG = 186 / PHASE_COUNT; // ~3.1
const TOTAL_POSSESSION_MESSAGES = 640;

// Match timeline: 45' H1, a 2' HT break, 45' H2 (extra time/pens omitted for simplicity).
const HALF_MS = 45 * 60 * 1000;
const HT_BREAK_MS = 2 * 60 * 1000;
const MATCH_DURATION_MS = HALF_MS + HT_BREAK_MS + HALF_MS;

function statusIdForTs(ts: number): 2 | 3 | 4 {
  if (ts < HALF_MS) return 2;
  if (ts < HALF_MS + HT_BREAK_MS) return 3;
  return 4;
}

/** Matches the real feed's Clock shape: { Running, Seconds } — see FEEDBACK.md. */
function clockForTs(ts: number): { Running: boolean; Seconds: number } {
  const statusId = statusIdForTs(ts);
  const minuteOffset = statusId === 4 ? -HT_BREAK_MS : 0;
  const matchMs = statusId === 3 ? HALF_MS : ts + minuteOffset;
  return { Running: statusId !== 3, Seconds: Math.floor(matchMs / 1000) };
}

interface RawMsg {
  Action: string;
  Ts: number;
  Participant?: 1 | 2;
  Confirmed?: boolean;
  Unreliable?: boolean;
  Reliable?: boolean;
}

function buildFixture(): ScoreMessage[] {
  const messages: ScoreMessage[] = [];
  let seq = 1;
  let p1Goals = 0;
  let p2Goals = 0;

  const push = (m: RawMsg) => {
    const message: ScoreMessage = {
      ...m,
      Seq: seq,
      Id: seq,
      StatusId: statusIdForTs(m.Ts),
      Clock: clockForTs(m.Ts),
      // Matches the real feed's Score shape: keyed by period under Participant1/2 — see FEEDBACK.md.
      Score: { Participant1: { Total: { Goals: p1Goals } }, Participant2: { Total: { Goals: p2Goals } } },
    };
    messages.push(message);
    seq++;
  };

  // Spread 60 phases roughly evenly across playing time (skip the HT break), with jitter.
  const phaseStartTimes: number[] = [];
  const slot = (HALF_MS * 2) / PHASE_COUNT;
  for (let i = 0; i < PHASE_COUNT; i++) {
    const jitter = (rand() - 0.5) * slot * 0.6;
    const rawTs = Math.max(1000, i * slot + slot / 2 + jitter);
    // Push anything that would land in the HT break out past it.
    const ts = rawTs >= HALF_MS ? rawTs + HT_BREAK_MS : rawTs;
    phaseStartTimes.push(ts);
  }
  phaseStartTimes.sort((a, b) => a - b);

  let lastHeartbeatTs = 0;
  const heartbeatEvery = MATCH_DURATION_MS / TOTAL_POSSESSION_MESSAGES;

  for (let i = 0; i < PHASE_COUNT; i++) {
    const start = phaseStartTimes[i];
    const attacker = ((i % 2) + 1) as 1 | 2; // exact 50/50 split by phase index
    const defender = attacker === 1 ? 2 : 1;

    // Ambient possession heartbeat between the previous phase and this one.
    while (lastHeartbeatTs + heartbeatEvery < start) {
      lastHeartbeatTs += heartbeatEvery;
      const participant = rand() < 0.5 ? 1 : 2;
      push({
        Action: rand() < 0.5 ? "safe_possession" : "attack_possession",
        Participant: participant as 1 | 2,
        Ts: Math.round(lastHeartbeatTs),
        Confirmed: true,
      });
    }

    const tier = pickTier();
    const delaySec = sampleResolutionDelaySec();
    const delayMs = Math.round(delaySec * 1000);

    // Danger signals re-firing within the phase (collapsed into one round by the engine).
    const signalCount = Math.max(1, Math.round(DANGER_SIGNALS_PER_PHASE_AVG + (rand() - 0.5)));
    for (let s = 0; s < signalCount; s++) {
      const t = start + (delayMs > 0 ? Math.min(s * (delayMs / (signalCount + 1)), delayMs - 50) : 0);
      push({
        Action: s === 0 ? "danger_possession" : "high_danger_possession",
        Participant: attacker,
        Ts: Math.round(t),
        Confirmed: true,
      });
    }

    const resolveTs = start + delayMs;

    switch (tier) {
      case "DEFENSE_CLEAN":
        push({
          Action: rand() < 0.5 ? "safe_possession" : "possession",
          Participant: defender,
          Ts: resolveTs,
          Confirmed: true,
        });
        break;
      case "SHOT":
        push({ Action: "shot", Participant: attacker, Ts: resolveTs, Confirmed: true });
        break;
      case "CORNER":
        push({ Action: "corner", Participant: attacker, Ts: resolveTs, Confirmed: true });
        break;
      case "GOAL":
        if (attacker === 1) p1Goals++;
        else p2Goals++;
        push({ Action: "goal", Participant: attacker, Ts: resolveTs, Confirmed: true });
        break;
      case "PENALTY":
        if (attacker === 1) p1Goals++;
        else p2Goals++;
        push({ Action: "penalty", Participant: attacker, Ts: resolveTs, Confirmed: true });
        break;
      case "FREEKICK_ATT":
        push({ Action: "free_kick", Participant: attacker, Ts: resolveTs, Confirmed: true });
        break;
      case "VOID":
        // Deliberately emit nothing that matches a resolution rule; the round engine's
        // 60s timeout backstop voids it. Delay is capped under 58.9s by design (§2 max).
        break;
    }

    lastHeartbeatTs = resolveTs;
  }

  // Sprinkle two reliability-guard messages so the pause/resume path is exercised.
  const guardTs = HALF_MS * 0.42;
  push({ Action: "unreliable_corners", Ts: Math.round(guardTs), Unreliable: true });
  push({ Action: "unreliable_corners", Ts: Math.round(guardTs + 15000), Reliable: true });

  // A synthetic half-time marker so StatusId 3 (HT) actually appears in the stream.
  push({ Action: "half_time", Ts: HALF_MS + 500 });

  messages.sort((a, b) => a.Ts - b.Ts);
  return messages;
}

function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DATA_DIR = path.resolve(__dirname, "../../../../data/raw");
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const fixtureId = process.argv[2] ?? "synthetic-18237038";
  const messages = buildFixture();
  const outPath = path.join(DATA_DIR, `${fixtureId}.jsonl`);
  fs.writeFileSync(outPath, messages.map((m) => JSON.stringify(m)).join("\n") + "\n", "utf8");
  console.log(`Generated ${messages.length} synthetic messages -> ${outPath}`);
}

main();
