import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Redis } from "ioredis";
import type { GuessRequest, LullGuessRequest } from "@final-third/shared";
import { ReplaySource } from "./feed/ReplaySource.js";
import { LiveSource } from "./feed/LiveSource.js";
import { TxLineAuth } from "./txlineAuth.js";
import type { FeedSource } from "./feed/FeedSource.js";
import { GameRoom } from "./gameRoom.js";
import { MemoryLeaderboardStore } from "./store/LeaderboardStore.js";
import { RedisLeaderboardStore } from "./store/RedisLeaderboardStore.js";
import type { LeaderboardStore } from "./store/LeaderboardStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../data/raw");

const PORT = Number(process.env.PORT ?? 4000);
const FEED_MODE = process.env.FEED_MODE ?? "replay";
const REPLAY_FIXTURE_ID = process.env.REPLAY_FIXTURE_ID ?? "18237038";
const REPLAY_SPEED = Number(process.env.REPLAY_SPEED ?? 20);
const REPLAY_START_OFFSET_MS = Number(process.env.REPLAY_START_OFFSET_MS ?? 0);
const LIVE_FIXTURE_ID = process.env.LIVE_FIXTURE_ID;

function resolveReplayFile(fixtureId: string): string {
  const real = path.join(DATA_DIR, `${fixtureId}.jsonl`);
  if (fs.existsSync(real)) return real;
  const synthetic = path.join(DATA_DIR, `synthetic-${fixtureId}.jsonl`);
  if (fs.existsSync(synthetic)) return synthetic;
  throw new Error(
    `No fixture data found for ${fixtureId}. Run \`npm run fetch:historical\` (needs TXLINE_API_TOKEN) ` +
      `or \`npm run gen:synthetic\` to generate one first.`
  );
}

function buildFeedSource(): { feed: FeedSource; fixtureId: string } {
  if (FEED_MODE === "live") {
    const apiToken = process.env.TXLINE_API_TOKEN;
    if (!apiToken) throw new Error("FEED_MODE=live requires TXLINE_API_TOKEN to be set.");
    if (!LIVE_FIXTURE_ID) throw new Error("FEED_MODE=live requires LIVE_FIXTURE_ID to be set.");
    const baseUrl = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
    const auth = new TxLineAuth(baseUrl, apiToken);
    return { feed: new LiveSource({ auth, baseUrl, fixtureId: LIVE_FIXTURE_ID }), fixtureId: LIVE_FIXTURE_ID };
  }

  const filePath = resolveReplayFile(REPLAY_FIXTURE_ID);
  const fixtureId = path.basename(filePath).startsWith("synthetic-")
    ? `synthetic-${REPLAY_FIXTURE_ID}`
    : REPLAY_FIXTURE_ID;
  return {
    feed: new ReplaySource({ filePath, speed: REPLAY_SPEED, loop: true, startOffsetMs: REPLAY_START_OFFSET_MS }),
    fixtureId,
  };
}

function buildLeaderboardStore(): LeaderboardStore {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("REDIS_URL not set: using in-memory leaderboard (streaks reset on restart).");
    return new MemoryLeaderboardStore();
  }
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  let loggedFailure = false;
  redis.on("error", (err: Error) => {
    if (loggedFailure) return; // ioredis retries internally; avoid spamming the console.
    loggedFailure = true;
    console.error("Redis connection failed, falling back to in-memory leaderboard:", err.message);
  });
  redis.connect().catch(() => {});
  return new RedisLeaderboardStore(redis);
}

async function main() {
  const { feed, fixtureId } = buildFeedSource();
  const leaderboard = buildLeaderboardStore();
  const room = new GameRoom(fixtureId, feed, leaderboard);
  room.start();

  console.log(
    `Final Third relay starting: mode=${FEED_MODE} fixtureId=${fixtureId} speed=${FEED_MODE === "replay" ? REPLAY_SPEED : "n/a"}`
  );

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();

    const existingPlayerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
    const playerId = room.addConnection(res, existingPlayerId);

    req.on("close", () => room.removeConnection(playerId));
  });

  app.post("/api/guess", async (req, res) => {
    const body = req.body as Partial<GuessRequest>;
    if (!body.playerId || !body.roundId || !body.side) {
      res.status(400).json({ ok: false, error: "playerId, roundId, and side are required." });
      return;
    }
    const result = await room.submitGuess(body as GuessRequest);
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/api/lull-guess", async (req, res) => {
    const body = req.body as Partial<LullGuessRequest>;
    if (!body.playerId || !body.roundId || !body.side) {
      res.status(400).json({ ok: false, error: "playerId, roundId, and side are required." });
      return;
    }
    const result = await room.submitLullGuess(body as LullGuessRequest);
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.get("/api/leaderboard", async (_req, res) => {
    const entries = await room.getLeaderboard(20);
    res.json({ fixtureId: room.fixtureId, entries });
  });

  app.get("/api/streak/:playerId", async (req, res) => {
    const streak = await room.getStreak(req.params.playerId);
    res.json(streak);
  });

  app.get("/api/fixture", (_req, res) => {
    res.json(room.getFixtureTheme());
  });

  app.get("/api/share-data/:playerId", async (req, res) => {
    res.json(await room.getShareData(req.params.playerId));
  });

  app.get("/health", (_req, res) => res.json({ ok: true, fixtureId: room.fixtureId, mode: FEED_MODE }));

  app.listen(PORT, () => {
    console.log(`Final Third relay listening on :${PORT}`);
  });

  process.on("SIGINT", () => {
    room.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Relay failed to start:", err);
  process.exit(1);
});
