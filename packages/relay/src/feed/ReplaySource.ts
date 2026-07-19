import fs from "node:fs";
import readline from "node:readline";
import { STATUS_ID, type ScoreMessage } from "@final-third/shared";
import type { FeedSource } from "./FeedSource.js";

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
    this.runOnce(onMessage);
  }

  private runOnce(onMessage: (msg: ScoreMessage) => void): void {
    ReplaySource.load(this.opts.filePath)
      .then((allMessages) => {
        if (this.stopped || allMessages.length === 0) return;

        let offsetMs = this.opts.startOffsetMs ?? 0;
        if (offsetMs === 0) {
          const kickoffMsg = allMessages.find((m) => m.StatusId === STATUS_ID.FIRST_HALF);
          if (kickoffMsg) {
            offsetMs = kickoffMsg.Ts - allMessages[0].Ts;
          }
        }
        const cutoff = allMessages[0].Ts + offsetMs;
        const messages = offsetMs > 0 ? allMessages.filter((m) => m.Ts >= cutoff) : allMessages;
        if (messages.length === 0) return;

        const t0 = messages[0].Ts;
        this.t0 = t0;
        this.startedAtRealMs = Date.now();

        for (const msg of messages) {
          const delayMs = (msg.Ts - t0) / this.speed;
          const timer = setTimeout(() => {
            if (!this.stopped) onMessage(msg);
          }, Math.max(0, delayMs));
          this.timers.push(timer);
        }

        if (this.loop) {
          const last = messages[messages.length - 1];
          const totalDelay = (last.Ts - t0) / this.speed;
          const loopTimer = setTimeout(() => {
            if (!this.stopped) this.runOnce(onMessage);
          }, totalDelay + 1000);
          this.timers.push(loopTimer);
        }
      })
      .catch((err) => {
        console.error(`ReplaySource failed to load ${this.opts.filePath}:`, err);
      });
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }
}
