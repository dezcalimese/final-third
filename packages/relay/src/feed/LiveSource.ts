import type { ScoreMessage } from "@final-third/shared";
import type { FeedSource } from "./FeedSource.js";
import type { TxLineAuth } from "../txlineAuth.js";

export interface LiveSourceOptions {
  auth: TxLineAuth;
  baseUrl: string;
  /**
   * /api/scores/stream is a single global feed across every fixture currently live
   * on the selected network, not scoped to one match (confirmed: every message carries its own
   * `FixtureId`). Only messages matching this fixture are passed to onMessage —
   * everything else is silently dropped so the round engine never sees another
   * match's events mixed in.
   */
  fixtureId: string;
  /** Initial backoff in ms; doubles on each consecutive failure, capped at maxBackoffMs. */
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

/**
 * Live SSE connection to /api/scores/stream (§4). Same FeedSource shape as
 * ReplaySource — the round engine and everything downstream cannot tell them apart.
 * Reconnects with exponential backoff on drop; renews the guest JWT on 401 via
 * TxLineAuth.getJwt(true) before retrying.
 */
export class LiveSource implements FeedSource {
  private stopped = false;
  private backoffMs: number;
  private readonly maxBackoffMs: number;
  private controller: AbortController | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly opts: LiveSourceOptions) {
    this.backoffMs = opts.initialBackoffMs ?? 1_000;
    this.maxBackoffMs = opts.maxBackoffMs ?? 30_000;
  }

  start(onMessage: (msg: ScoreMessage) => void): void {
    this.stopped = false;
    void this.connect(onMessage);
  }

  /** Live feed timestamps are real epoch ms already, so this clock is just Date.now(). */
  now(): number {
    return Date.now();
  }

  /** Live feed is already 1:1 with wall-clock, so no speed scaling needed. */
  realMsUntil(ts: number): number {
    return ts - this.now();
  }

  private async connect(onMessage: (msg: ScoreMessage) => void, forceJwtRefresh = false): Promise<void> {
    if (this.stopped) return;

    const jwt = await this.opts.auth.getJwt(forceJwtRefresh);
    this.controller = new AbortController();

    try {
      const res = await fetch(`${this.opts.baseUrl}/api/scores/stream`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-Api-Token": this.opts.auth.getApiToken(),
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: this.controller.signal,
      });

      if (res.status === 401) {
        this.scheduleReconnect(onMessage, true);
        return;
      }

      // 403 = token/network rejected or live window closed (e.g. post-tournament).
      // Retrying forever just spams the API — stop and leave replay mode as the path forward.
      if (res.status === 403) {
        console.error(
          `LiveSource got HTTP 403 from ${this.opts.baseUrl}/api/scores/stream — ` +
            `live feed unavailable. Set FEED_MODE=replay and restart the relay.`
        );
        this.stopped = true;
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error(`Live stream connect failed: HTTP ${res.status}`);
      }

      console.log(`LiveSource connected to ${this.opts.baseUrl}/api/scores/stream (filtering for fixture ${this.opts.fixtureId})`);

      // Connected: reset backoff.
      this.backoffMs = this.opts.initialBackoffMs ?? 1_000;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let matchedSeen = 0;

      while (!this.stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separator = buffer.match(/\r?\n\r?\n/);
        while (separator?.index !== undefined) {
          const block = buffer.slice(0, separator.index);
          buffer = buffer.slice(separator.index + separator[0].length);
          const dataLines = block
            .split(/\r?\n/)
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart());
          if (dataLines.length > 0) {
            try {
              const msg = JSON.parse(dataLines.join("\n")) as ScoreMessage;
              // The stream also carries bare keepalive pings ({"Ts": <seconds>}, no
              // Action/FixtureId) and every other currently-live fixture's events —
              // only log+forward the ones for our match.
              if (String(msg.FixtureId) === this.opts.fixtureId) {
                matchedSeen++;
                console.log(`[live ${this.opts.fixtureId}] #${matchedSeen} ${msg.Action} Ts=${msg.Ts} Participant=${msg.Participant ?? "-"}`);
                onMessage(msg);
              }
            } catch {
              // Skip malformed/heartbeat blocks.
            }
          }
          separator = buffer.match(/\r?\n\r?\n/);
        }
      }

      if (!this.stopped) this.scheduleReconnect(onMessage, false);
    } catch (err) {
      if (this.stopped) return;
      console.error("LiveSource stream error, reconnecting:", (err as Error).message);
      this.scheduleReconnect(onMessage, false);
    }
  }

  private scheduleReconnect(onMessage: (msg: ScoreMessage) => void, forceJwtRefresh: boolean): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      void this.connect(onMessage, forceJwtRefresh);
    }, this.backoffMs);
  }

  stop(): void {
    this.stopped = true;
    this.controller?.abort();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
}
