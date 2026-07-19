import type { Redis } from "ioredis";
import type { LeaderboardEntry, PlayerStreak } from "@final-third/shared";
import type { LeaderboardStore } from "./LeaderboardStore.js";

/**
 * Redis-backed implementation (§5): sorted set per fixture for the leaderboard
 * (ZADD/ZREVRANK on best streak), a hash per player for current-streak state,
 * and a global sorted set for the player's best streak across all matches.
 */
export class RedisLeaderboardStore implements LeaderboardStore {
  constructor(private readonly redis: Redis) {}

  private lbKey(fixtureId: string) {
    return `ft:leaderboard:${fixtureId}`;
  }
  private streakKey(fixtureId: string, playerId: string) {
    return `ft:streak:${fixtureId}:${playerId}`;
  }
  private globalKey() {
    return `ft:leaderboard:global`;
  }
  private accuracyKey(fixtureId: string, playerId: string) {
    return `ft:accuracy:${fixtureId}:${playerId}`;
  }

  async getStreak(fixtureId: string, playerId: string): Promise<PlayerStreak> {
    const data = await this.redis.hgetall(this.streakKey(fixtureId, playerId));
    return {
      current: Number(data.current ?? 0),
      best: Number(data.best ?? 0),
    };
  }

  async recordOutcome(fixtureId: string, playerId: string, correct: boolean): Promise<PlayerStreak> {
    const prev = await this.getStreak(fixtureId, playerId);
    const current = correct ? prev.current + 1 : 0;
    const best = Math.max(prev.best, current);

    await this.redis.hset(this.streakKey(fixtureId, playerId), { current, best });
    // GT: only raise the leaderboard score, never lower it. CH: return changed count (unused here).
    await this.redis.zadd(this.lbKey(fixtureId), "GT", "CH", best, playerId);
    await this.redis.zadd(this.globalKey(), "GT", "CH", best, playerId);

    await this.redis.hincrby(this.accuracyKey(fixtureId, playerId), "total", 1);
    if (correct) await this.redis.hincrby(this.accuracyKey(fixtureId, playerId), "wins", 1);

    return { current, best };
  }

  async getAccuracy(fixtureId: string, playerId: string): Promise<{ wins: number; total: number }> {
    const data = await this.redis.hgetall(this.accuracyKey(fixtureId, playerId));
    return { wins: Number(data.wins ?? 0), total: Number(data.total ?? 0) };
  }

  async getLeaderboard(fixtureId: string, limit = 20): Promise<LeaderboardEntry[]> {
    const raw = await this.redis.zrevrange(this.lbKey(fixtureId), 0, limit - 1, "WITHSCORES");
    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({
        playerId: raw[i],
        bestStreak: Number(raw[i + 1]),
        rank: i / 2 + 1,
      });
    }
    return entries;
  }

  async getGlobalBest(playerId: string): Promise<number> {
    const score = await this.redis.zscore(this.globalKey(), playerId);
    return score ? Number(score) : 0;
  }

  async getPercentileBeaten(fixtureId: string, streak: number): Promise<number> {
    const total = await this.redis.zcard(this.lbKey(fixtureId));
    if (total === 0) return 100;
    // Count of members with score < streak == rank (0-indexed) of the first member >= streak
    // from the bottom. ZCOUNT is the simplest correct way to get this directly.
    const beaten = await this.redis.zcount(this.lbKey(fixtureId), "-inf", `(${streak}`);
    return Math.round((beaten / total) * 100);
  }
}
