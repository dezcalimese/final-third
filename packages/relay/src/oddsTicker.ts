/**
 * Odds feed is real, separate, and slower than the scores feed (§2: refreshes
 * roughly every 1-2 minutes) — GET /api/odds/stream / /api/odds/snapshot/{id} per §4.
 * There's no recorded odds JSONL in this build (only scores were prioritized per the
 * §7 build order, and TXLINE_API_TOKEN isn't available here), so this is a clearly
 * synthetic random-walk stand-in for a single OVERUNDER_PARTICIPANT_GOALS market,
 * used only to drive the lull-fallback round (§3) end-to-end. Swap this for a real
 * OddsSource reading /api/odds/snapshot once a token + recorded odds pulls exist —
 * the GameRoom only depends on the {pct, onUpdate} shape below.
 */
export class SyntheticOddsTicker {
  private pct: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly intervalMs: number,
    private readonly onUpdate: (pct: number) => void,
    private readonly marketLabel = "Over 2.5 Goals"
  ) {
    this.pct = 52 + Math.random() * 12;
  }

  getMarketLabel(): string {
    return this.marketLabel;
  }

  getPct(): number {
    return this.pct;
  }

  start(): void {
    this.timer = setInterval(() => {
      const drift = (Math.random() - 0.5) * 4;
      this.pct = Math.min(88, Math.max(15, this.pct + drift));
      this.onUpdate(this.pct);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
