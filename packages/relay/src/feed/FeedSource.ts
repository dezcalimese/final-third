import type { ScoreMessage } from "@final-third/shared";

/**
 * The single abstraction the rest of the system is built on (§5): swap LiveSource
 * for ReplaySource and nothing downstream — round engine, relay, client — can tell
 * the difference. This is the dev environment, the demo engine, and the
 * post-deadline survival plan in one interface.
 */
export interface FeedSource {
  /** Begin delivering messages in stream order; call onMessage for each. */
  start(onMessage: (msg: ScoreMessage) => void): void;
  /** Stop delivering messages and release any timers/connections. */
  stop(): void;
  /**
   * Current time in this source's own domain. LiveSource returns real epoch ms
   * (Date.now()). ReplaySource returns virtual fixture time — the original
   * message Ts values scaled by playback speed — NOT wall-clock, since replayed
   * historical Ts values are from whenever the real match was played. The round
   * engine's lock/timeout deadlines and guess submission times must all be read
   * from this clock so they stay in the same domain as the Ts on incoming messages.
   */
  now(): number;
  /**
   * Wall-clock milliseconds from right now until the given source-domain timestamp
   * occurs, accounting for replay speed. Used to translate deadlines (e.g. the round
   * lock window) into real ms the client can safely diff against its own Date.now().
   */
  realMsUntil(ts: number): number;
}
