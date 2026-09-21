import fs from "node:fs";
import readline from "node:readline";
import { STATUS_ID, type ScoreMessage } from "@final-third/shared";
import type { FeedSource } from "./FeedSource.js";

/** Actions that open a round in RoundEngine — keep this list in sync with tryTrigger. */
const DANGER_ACTIONS = new Set(["danger_possession", "high_danger_possession"]);

/** Brief calm before the first trigger so the UI can paint before the lock window opens. */
const DANGER_LEAD_IN_MS = 2_000;

function isRoundTrigger(m: ScoreMessage): boolean {
  return (
    DANGER_ACTIONS.has(m.Action) &&
    m.Confirmed !== false &&
    (m.Participant === 1 || m.Participant === 2)
  );
}

export interface ReplaySourceOptions {
  /** Path to a JSONL file of ScoreMessages, one per line, sorted or unsorted by Ts. */
  filePath: string;
  /** Playback speed multiplier: 1x = real-time, 20x = 20x faster (dev default). */
  speed?: number;
  /** Loop back to the start when the fixture ends (useful for long demo sessions). */
  loop?: boolean;
  /**
   * Skip this many fixture-time ms from the start of the file before replaying —
   * non-destructive (the underlying file is untouched, just read and filtered).
   * Real fixtures open with pre-match coverage setup and typically ~20 minutes of
   * low-danger play before the first round trigger; for a live demo recording, set
   * this to start just before the first `danger_possession` instead of waiting
   * through all of that in real time.
   */
  startOffsetMs?: number;
  /**
   * Jump to just before the first confirmed danger/high-danger possession that
   * would open a round. Prefer this over a hand-tuned `startOffsetMs` for demos —
   * real fixtures typically sit ~5 minutes after kickoff before the first trigger.
   * Ignored when `startOffsetMs` is set (> 0).
   */
  skipToDanger?: boolean;
}

/**
 * Replays a recorded fixture (JSONL of ScoreMessages) at a configurable speed,
 * preserving the original inter-message gaps scaled by `speed`. This is the
 * primary demo mode (§5) and the only mode guaranteed to work post-July-19,
 * once the live devnet data window closes.
 */
export class ReplaySource implements FeedSource {
  private timers: NodeJS.Timeout[] = [];
  private stopped = false;
  private readonly speed: number;
  private readonly loop: boolean;
  private t0: number | null = null;
  private startedAtRealMs = 0;
  /** Full message list for the current run (after start-offset filtering). */
  private messages: ScoreMessage[] = [];
  private onMessage: ((msg: ScoreMessage) => void) | null = null;

  constructor(private readonly opts: ReplaySourceOptions) {
    this.speed = opts.speed ?? 1;
    this.loop = opts.loop ?? false;
  }

  /** Virtual fixture time — see FeedSource.now() doc. 0 until the fixture has loaded. */
  now(): number {
    if (this.t0 === null) return 0;
    return this.t0 + (Date.now() - this.startedAtRealMs) * this.speed;
  }

  /** Virtual ms are compressed by `speed`, so real ms remaining is scaled back down. */
  realMsUntil(ts: number): number {
    return (ts - this.now()) / this.speed;
  }

  static async load(filePath: string): Promise<ScoreMessage[]> {
    const messages: ScoreMessage[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, "utf8"),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      messages.push(JSON.parse(trimmed) as ScoreMessage);
    }
    messages.sort((a, b) => a.Ts - b.Ts);
    return messages;
  }

  start(onMessage: (msg: ScoreMessage) => void): void {
    this.stopped = false;
    this.onMessage = onMessage;
    this.runOnce(onMessage);
  }

  /**
   * Jump playback to just before the next round-triggering danger event.
   * Returns false if the fixture isn't loaded yet, nothing is ahead, or we're
   * already inside the lead-in of the next trigger.
   */
  skipToNextDanger(): boolean {
    if (this.stopped || !this.onMessage || this.messages.length === 0 || this.t0 === null) {
      return false;
    }

    const cursor = this.now();
    let nextDanger = this.messages.find((m) => m.Ts > cursor && isRoundTrigger(m));
    // Past the last trigger with loop on → wrap to the first one.
    if (!nextDanger && this.loop) {
      nextDanger = this.messages.find(isRoundTrigger);
    }
    if (!nextDanger) return false;

    const targetTs = nextDanger.Ts - DANGER_LEAD_IN_MS;
    if (targetTs <= cursor) return false;

    this.clearTimers();

    // Catch up score/clock without replaying skipped danger phases through the engine.
    // Only sync-deliver messages strictly before the new playhead so scheduleFrom
    // doesn't fire the same message again at delay 0.
    const catchUp = this.lastMessageAtOrBefore(targetTs);
    if (catchUp && catchUp.Ts < targetTs && catchUp.Ts < nextDanger.Ts) {
      this.onMessage(catchUp);
    }

    this.t0 = targetTs;
    this.startedAtRealMs = Date.now();
    this.scheduleFrom(targetTs, this.onMessage);
    return true;
  }

  private runOnce(onMessage: (msg: ScoreMessage) => void): void {
    ReplaySource.load(this.opts.filePath)
      .then((allMessages) => {
        if (this.stopped || allMessages.length === 0) return;

        let offsetMs = this.opts.startOffsetMs ?? 0;
        if (offsetMs === 0 && this.opts.skipToDanger) {
          const firstDanger = allMessages.find(isRoundTrigger);
          if (firstDanger) {
            offsetMs = Math.max(0, firstDanger.Ts - allMessages[0].Ts - DANGER_LEAD_IN_MS);
          }
        }
        if (offsetMs === 0) {
          const kickoffMsg = allMessages.find((m) => m.StatusId === STATUS_ID.FIRST_HALF);
          if (kickoffMsg) {
            offsetMs = kickoffMsg.Ts - allMessages[0].Ts;
          }
        }
        const cutoff = allMessages[0].Ts + offsetMs;
        const messages = offsetMs > 0 ? allMessages.filter((m) => m.Ts >= cutoff) : allMessages;
        if (messages.length === 0) return;

        this.messages = messages;
        this.onMessage = onMessage;
        this.t0 = messages[0].Ts;
        this.startedAtRealMs = Date.now();
        this.scheduleFrom(messages[0].Ts, onMessage);
      })
      .catch((err) => {
        console.error(`ReplaySource failed to load ${this.opts.filePath}:`, err);
      });
  }

  private scheduleFrom(fromTs: number, onMessage: (msg: ScoreMessage) => void): void {
    const remaining = this.messages.filter((m) => m.Ts >= fromTs);
    if (remaining.length === 0) return;

    for (const msg of remaining) {
      const delayMs = (msg.Ts - fromTs) / this.speed;
      const timer = setTimeout(() => {
        if (!this.stopped) onMessage(msg);
      }, Math.max(0, delayMs));
      this.timers.push(timer);
    }

    if (this.loop) {
      const last = remaining[remaining.length - 1];
      const totalDelay = (last.Ts - fromTs) / this.speed;
      const loopTimer = setTimeout(() => {
        if (!this.stopped) this.runOnce(onMessage);
      }, totalDelay + 1000);
      this.timers.push(loopTimer);
    }
  }

  private lastMessageAtOrBefore(ts: number): ScoreMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].Ts <= ts) return this.messages[i];
    }
    return undefined;
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.onMessage = null;
  }
}
