import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Redis } from "ioredis";
import { getKnownFixture, getTeamTheme, type GuessRequest, type LullGuessRequest } from "@final-third/shared";
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
// Replay at the fixture's natural pace by default. Prediction deadlines use the
// same fixture-time clock as feed events, so accelerating the feed also shrinks
// the player's real-world response window (e.g. 4s becomes 2s at 2x).
const REPLAY_SPEED = Number(process.env.REPLAY_SPEED ?? 1);
const REPLAY_START_OFFSET_MS = Number(process.env.REPLAY_START_OFFSET_MS ?? 0);
const LIVE_FIXTURE_ID = process.env.LIVE_FIXTURE_ID;

function discoverReplayFixtures(): { fixtureId: string; filePath: string; label: string }[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".jsonl") && !f.startsWith("synthetic-"))
    .map((f) => {
      const fixtureId = f.replace(".jsonl", "");
      const known = getKnownFixture(fixtureId);
      return {
        fixtureId,
        filePath: path.join(DATA_DIR, f),
        label: known?.label ?? `Fixture ${fixtureId}`,
      };
    });
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
    if (loggedFailure) return;
    loggedFailure = true;
    console.error("Redis connection failed, falling back to in-memory leaderboard:", err.message);
  });
  redis.connect().catch(() => {});
  return new RedisLeaderboardStore(redis);
}

function getRoom(rooms: Map<string, GameRoom>, fixtureId: string | undefined): GameRoom | null {
  if (!fixtureId) return null;
  return rooms.get(fixtureId) ?? null;
}

async function main() {
  const leaderboard = buildLeaderboardStore();
  const rooms = new Map<string, GameRoom>();

  // Per-connection replay rooms: each SSE connection gets its own fresh replay
  // starting from kickoff. Keyed by playerId so guess/leaderboard calls find the
  // right room. For live mode, one shared room is used instead.
  const playerRooms = new Map<string, GameRoom>();

  // Fixture metadata (discovered once at startup for the /api/fixtures listing).
  // Replay fixtures remain available alongside a live room.
  const replayFixtures = discoverReplayFixtures();

  if (FEED_MODE === "live") {
    const apiToken = process.env.TXLINE_API_TOKEN;
    if (!apiToken) throw new Error("FEED_MODE=live requires TXLINE_API_TOKEN to be set.");
    if (!LIVE_FIXTURE_ID) throw new Error("FEED_MODE=live requires LIVE_FIXTURE_ID to be set.");
    const baseUrl = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
    const auth = new TxLineAuth(baseUrl, apiToken);
    const feed: FeedSource = new LiveSource({ auth, baseUrl, fixtureId: LIVE_FIXTURE_ID });
    const room = new GameRoom(LIVE_FIXTURE_ID, feed, leaderboard);
    room.start();
    rooms.set(LIVE_FIXTURE_ID, room);
    console.log(`Live room started: ${LIVE_FIXTURE_ID}`);
  } else if (replayFixtures.length === 0) {
      throw new Error(
        `No fixture data in ${DATA_DIR}. Run \`npm run fetch:historical\` or \`npm run gen:synthetic\`.`
      );
  }

  for (const f of replayFixtures) {
    console.log(`Replay fixture available: ${f.fixtureId} (${f.label}) speed=${REPLAY_SPEED}x`);
  }

  function createReplayRoom(fixtureId: string): GameRoom | null {
    const f = replayFixtures.find((rf) => rf.fixtureId === fixtureId);
    if (!f) return null;
    const feed = new ReplaySource({
      filePath: f.filePath,
      speed: REPLAY_SPEED,
      loop: true,
      startOffsetMs: REPLAY_START_OFFSET_MS,
    });
    const room = new GameRoom(f.fixtureId, feed, leaderboard, REPLAY_SPEED);
    room.start();
    return room;
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/fixtures", (_req, res) => {
    const liveFixtures = [...rooms.values()].map((room) => {
        const theme = room.getFixtureTheme();
        const known = getKnownFixture(room.fixtureId);
        return { ...theme, label: known?.label ?? `Fixture ${room.fixtureId}`, isLive: true };
      });
    const replayOptions = replayFixtures
      .filter((f) => !rooms.has(f.fixtureId))
      .map((f) => {
        const known = getKnownFixture(f.fixtureId);
        return {
          fixtureId: f.fixtureId,
          participant1: getTeamTheme(known?.home),
          participant2: getTeamTheme(known?.away),
          label: known?.label ?? f.label,
          isLive: false,
        };
      });
    res.json([...liveFixtures, ...replayOptions]);
  });

  app.get("/api/stream", (req, res) => {
    const fixtureId = typeof req.query.fixtureId === "string" ? req.query.fixtureId : undefined;

    // Live fixtures use their persistent shared room. Replay fixtures get a fresh
    // per-connection room so every player starts from kickoff.
    const liveRoom = getRoom(rooms, fixtureId);
    const room = liveRoom
      ?? (fixtureId ? createReplayRoom(fixtureId) : rooms.values().next().value)
      ?? createReplayRoom(replayFixtures[0]?.fixtureId);
    if (!room) {
      res.status(404).json({ error: "No active rooms." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();

    const existingPlayerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
    const playerId = room.addConnection(res, existingPlayerId);
    playerRooms.set(playerId, room);

    req.on("close", () => {
      room!.removeConnection(playerId);
      if (!liveRoom) room!.stop();
      playerRooms.delete(playerId);
    });
  });

  function findRoom(fixtureId?: string, playerId?: string): GameRoom | undefined {
    if (playerId && playerRooms.has(playerId)) return playerRooms.get(playerId)!;
    return getRoom(rooms, fixtureId) ?? rooms.values().next().value ?? undefined;
  }

  app.post("/api/guess", async (req, res) => {
    const body = req.body as Partial<GuessRequest & { fixtureId?: string }>;
    if (!body.playerId || !body.roundId || !body.side) {
      res.status(400).json({ ok: false, error: "playerId, roundId, and side are required." });
      return;
    }
    const room = findRoom(body.fixtureId, body.playerId);
    if (!room) { res.status(404).json({ ok: false, error: "No active room." }); return; }
    const result = await room.submitGuess(body as GuessRequest);
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/api/lull-guess", async (req, res) => {
    const body = req.body as Partial<LullGuessRequest & { fixtureId?: string }>;
    if (!body.playerId || !body.roundId || !body.side) {
      res.status(400).json({ ok: false, error: "playerId, roundId, and side are required." });
      return;
    }
    const room = findRoom(body.fixtureId, body.playerId);
    if (!room) { res.status(404).json({ ok: false, error: "No active room." }); return; }
    const result = await room.submitLullGuess(body as LullGuessRequest);
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.get("/api/leaderboard", async (req, res) => {
    const fixtureId = typeof req.query.fixtureId === "string" ? req.query.fixtureId : undefined;
    const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
    const room = findRoom(fixtureId, playerId);
    if (!room) { res.status(404).json({ entries: [] }); return; }
    const entries = await room.getLeaderboard(20);
    res.json({ fixtureId: room.fixtureId, entries });
  });

  app.get("/api/streak/:playerId", async (req, res) => {
    const fixtureId = typeof req.query.fixtureId === "string" ? req.query.fixtureId : undefined;
    const room = findRoom(fixtureId, req.params.playerId);
    if (!room) { res.json({ current: 0, best: 0 }); return; }
    const streak = await room.getStreak(req.params.playerId);
    res.json(streak);
  });

  app.get("/api/fixture", (req, res) => {
    const fixtureId = typeof req.query.fixtureId === "string" ? req.query.fixtureId : undefined;
    const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
    const room = findRoom(fixtureId, playerId);
    if (!room) { res.status(404).json({ error: "No active room." }); return; }
    res.json(room.getFixtureTheme());
  });

  app.get("/api/share-data/:playerId", async (req, res) => {
    const fixtureId = typeof req.query.fixtureId === "string" ? req.query.fixtureId : undefined;
    const room = findRoom(fixtureId, req.params.playerId);
    if (!room) { res.status(404).json({}); return; }
    res.json(await room.getShareData(req.params.playerId));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: [...rooms.keys()], mode: FEED_MODE });
  });

  app.listen(PORT, () => {
    console.log(`Final Third relay listening on :${PORT} (${rooms.size} room${rooms.size === 1 ? "" : "s"})`);
  });

  process.on("SIGINT", () => {
    for (const room of rooms.values()) room.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Relay failed to start:", err);
  process.exit(1);
});
