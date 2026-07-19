# Final Third

A live prediction game for World Cup matches, built for the TxODDS
World Cup Hackathon (Track 2: Consumer & Fan Experiences).

**No wagering in this build.** This is a companion game for watching live soccer —
the current version is free to play with no stakes.

## The pitch

Watching a match alone is passive. Final Third turns the TxLINE possession-danger
feed into a duel: when a team's pressure escalates to danger, you get ~4 seconds to
call **ATTACK** (this pressure produces a shot, corner, or goal) or **DEFENSE** (the
defense deals with it cleanly). The phase plays out — 2 to 58 seconds, entirely
event-driven, never clock-driven — and your streak lives or dies on whether you read
the pressure correctly. Long sieges are a feature, not a bug: the tension compounds
the longer a phase drags on, and the eventual resolution — clean defense, a shot, a
corner, or a jackpot goal — hits harder for having waited.

Every call is graded against the real TxLINE feed. During quiet spells or half-time,
a secondary "market call" round (higher/lower on a live odds market) keeps the screen
alive without the core mechanic getting stale.

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              Relay (Node/TS)             │
                    │         persistent process, not           │
                    │              serverless                   │
                    │                                            │
  TxLINE  ────────► │  FeedSource ──► RoundEngine ──► GameRoom  │ ────► Browser
  (devnet)          │  (Live or       (pure,          (SSE fan- │       (Next.js)
                     │   Replay)        deterministic)   out +   │
                     │                                   REST)   │
                     │                       │                    │
                     │                       ▼                    │
                     │              LeaderboardStore              │
                     │            (Redis, or in-memory)            │
                    └─────────────────────────────────────────┘
```

- **FeedSource** (`packages/relay/src/feed/`): a single interface with two
  implementations — `LiveSource` (SSE from `/api/scores/stream`) and `ReplaySource`
  (a recorded JSONL fixture, replayed at configurable speed). Everything downstream
  cannot tell them apart. This is the dev environment, the demo engine, and the
  post-deadline survival plan in one abstraction.
- **RoundEngine** (`packages/relay/src/engine/roundEngine.ts`): pure, deterministic
  round lifecycle (trigger → lock → resolve/void). No I/O, no timers — driven by
  explicit timestamps, so it's unit-tested against a recorded fixture.
- **GameRoom** (`packages/relay/src/gameRoom.ts`): owns one FeedSource → RoundEngine
  pipeline, fans events out to connected browsers over SSE, grades guesses, persists
  streaks.
- **Web client** (`packages/web/`): Next.js + React + TypeScript + Tailwind + Framer
  Motion. Solana wallet-connect-only sign-up (pubkey = player identity, no
  transactions ever). Server-rendered PNG share cards via Satori/`next/og`.

The API token never reaches the browser — the relay is the only thing that talks to
TxLINE.

## TxLINE endpoints used

| Endpoint | Purpose |
|---|---|
| `POST /auth/guest/start` | Guest JWT, refreshed on 401 |
| `GET /api/scores/historical/{fixtureId}` | Historical replay source (SSE returned as one string — see `FEEDBACK.md`) |
| `GET /api/scores/stream` | Live SSE scores stream |
| `GET /api/odds/stream`, `GET /api/odds/snapshot/{fixtureId}` | Odds (lull-fallback rounds) |

## Running in replay mode (the primary demo mode)

Replay mode is the default and needs no TxLINE credentials — it replays a recorded
fixture, which is also the only thing guaranteed to work once the live devnet data
window closes.

```bash
npm install                 # installs shared + relay (npm workspaces)
npm run install:web         # installs the web package (bun, kept separate — see below)
npm run build:shared

npm run gen:synthetic       # generates a synthetic fixture if you have no real pull yet
npm run dev:relay           # starts the relay on :4000 (FEED_MODE=replay by default)
npm run dev:web             # starts the Next.js app on :3000, in a second terminal
```

Open http://localhost:3000. `packages/relay/.env` (copy from `.env.example`) controls
`REPLAY_FIXTURE_ID` and `REPLAY_SPEED`. The default is `REPLAY_SPEED=3` (a 90-minute
match completes in ~30 minutes). The 4-second lock window scales with speed — at 3x
you get ~1.3 seconds to pick, which is tight but playable. Use `REPLAY_SPEED=1` for
real-time pacing, or higher values for quick iteration on the engine.

### Live mode

Set `TXLINE_API_TOKEN` in `packages/relay/.env`, then `FEED_MODE=live npm run dev:relay`.
Requires a fixture currently live on the devnet. The relay auto-refreshes its guest
JWT on 401 and reconnects the SSE stream with exponential backoff on drop.

### Fixture data

Two real fixtures already ship in `data/raw/`: `18237038.jsonl` (France–Spain semi)
and `18241006.jsonl` (England–Argentina semi), imported from raw `.sse` pulls made
before the devnet's 2-week replay window could age them out:

```bash
npm run import:fixture -- /path/to/fixture_18237038.sse
```

`TXLINE_API_TOKEN` was never available in this build environment to pull fixtures
directly via `fetch:historical` — the two real fixtures above were pulled separately
and imported through the same SSE parser `fetch:historical` uses. To pull more
fixtures directly once a token is available:

```bash
TXLINE_API_TOKEN=... npm run fetch:historical   # pulls all four known fixtures into data/raw/*.jsonl
```

A synthetic fixture (`data/raw/synthetic-18237038.jsonl`) remains as a fallback,
generated to match every measured parameter in the spec (~60 danger phases, 50/50
attack/defense split, the documented outcome-tier distribution, the documented
bimodal resolution-timing percentiles) — useful if you ever point `REPLAY_FIXTURE_ID`
at a fixture with no real data pulled. The relay always prefers real data over
synthetic once a matching `data/raw/{fixtureId}.jsonl` exists — no code changes
needed either way.

### Redis (optional)

Without `REDIS_URL` set, the relay uses an in-memory leaderboard (streaks reset on
restart) — the game is fully playable with zero infra. Set `REDIS_URL` (a local
`docker-compose up redis` is included) for persistent leaderboards.

## Monorepo layout

```
packages/
  shared/   types, team/theming map, match-state helpers — used by both relay and web
  relay/    the persistent Node/TS server (feed sources, round engine, GameRoom, REST+SSE)
  web/      Next.js client (bun-managed — see below)
data/raw/   recorded fixture JSONL files (the post-deadline survival plan)
```

**Why the web package uses bun while relay/shared use npm:** the Solana wallet-adapter
dependency tree resolves to conflicting React versions (down to `react-dom@16.14.0`
from a deep transitive) under plain npm workspaces; bun's installer resolves it
cleanly with a scoped `overrides` field. `packages/web` is deliberately excluded from
the root npm workspaces list and manages its own `bun.lock`; it depends on
`@final-third/shared` via `file:../shared`, so `npm run build:shared` must run before
the web app picks up shared-package changes.

## No wagering

The current version is free to play with no stakes. No money changes hands and no
wallet signs a transaction — the Solana wallet connection exists purely to give
players a persistent identity for the leaderboard.
