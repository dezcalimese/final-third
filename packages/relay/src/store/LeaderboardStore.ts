import type { LeaderboardEntry, PlayerStreak } from "@final-third/shared";

/**
 * Persists best-streak-per-player-per-match (leaderboard) and current streak state.
 * Two implementations: in-memory (works with zero setup, used automatically when
 * REDIS_URL is unset so the game is playable end-to-end without infra) and Redis
 * (sorted set per fixture, per §5 — used whenever REDIS_URL is configured).
 */
export interface LeaderboardStore {
  getStreak(fixtureId: string, playerId: string): Promise<PlayerStreak>;
  /** Apply +1/reset to the current streak; updates best if a new high was hit. Returns the new streak. */
  recordOutcome(fixtureId: string, playerId: string, correct: boolean): Promise<PlayerStreak>;
  getLeaderboard(fixtureId: string, limit?: number): Promise<LeaderboardEntry[]>;
  getGlobalBest(playerId: string): Promise<number>;
  /** Percentile helper for share cards: "beat X% of players" on this fixture. */
  getPercentileBeaten(fixtureId: string, streak: number): Promise<number>;
  /** Lifetime WIN/LOSS tally on this fixture, for the share card's accuracy stat. */
  getAccuracy(fixtureId: string, playerId: string): Promise<{ wins: number; total: number }>;
}

export class MemoryLeaderboardStore implements LeaderboardStore {
  private streaks = new Map<string, PlayerStreak>(); // key: `${fixtureId}:${playerId}`
  private globalBest = new Map<string, number>(); // key: playerId
  private accuracy = new Map<string, { wins: number; total: number }>(); // key: `${fixtureId}:${playerId}`

  private key(fixtureId: string, playerId: string) {
    return `${fixtureId}:${playerId}`;
  }

  async getStreak(fixtureId: string, playerId: string): Promise<PlayerStreak> {
    return this.streaks.get(this.key(fixtureId, playerId)) ?? { current: 0, best: 0 };
  }

  async recordOutcome(fixtureId: string, playerId: string, correct: boolean): Promise<PlayerStreak> {
    const key = this.key(fixtureId, playerId);
    const prev = this.streaks.get(key) ?? { current: 0, best: 0 };
    const current = correct ? prev.current + 1 : 0;
    const best = Math.max(prev.best, current);
    const next = { current, best };
    this.streaks.set(key, next);
    this.globalBest.set(playerId, Math.max(this.globalBest.get(playerId) ?? 0, best));

    const prevAccuracy = this.accuracy.get(key) ?? { wins: 0, total: 0 };
    this.accuracy.set(key, { wins: prevAccuracy.wins + (correct ? 1 : 0), total: prevAccuracy.total + 1 });

    return next;
  }

  async getAccuracy(fixtureId: string, playerId: string): Promise<{ wins: number; total: number }> {
    return this.accuracy.get(this.key(fixtureId, playerId)) ?? { wins: 0, total: 0 };
  }

  async getLeaderboard(fixtureId: string, limit = 20): Promise<LeaderboardEntry[]> {
    const entries = [...this.streaks.entries()]
      .filter(([key]) => key.startsWith(`${fixtureId}:`))
      .map(([key, streak]) => ({ playerId: key.slice(fixtureId.length + 1), bestStreak: streak.best }))
      .sort((a, b) => b.bestStreak - a.bestStreak)
      .slice(0, limit)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    return entries;
  }

  async getGlobalBest(playerId: string): Promise<number> {
    return this.globalBest.get(playerId) ?? 0;
  }

  async getPercentileBeaten(fixtureId: string, streak: number): Promise<number> {
    const all = [...this.streaks.entries()]
      .filter(([key]) => key.startsWith(`${fixtureId}:`))
      .map(([, s]) => s.best);
    if (all.length === 0) return 100;
    const beaten = all.filter((s) => s < streak).length;
    return Math.round((beaten / all.length) * 100);
  }
}
