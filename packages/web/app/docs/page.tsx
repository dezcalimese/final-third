import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Technical Docs — Final Third",
  description: "Technical overview, architecture, and TxLINE API integration details for the Final Third prediction game.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      {children}
    </section>
  );
}

function EndpointRow({ method, path, purpose }: { method: string; path: string; purpose: string }) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 pr-4 align-top">
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-bold text-emerald-400">{method}</span>
      </td>
      <td className="py-3 pr-4 align-top font-mono text-sm text-white/80">{path}</td>
      <td className="py-3 text-sm text-white/60">{purpose}</td>
    </tr>
  );
}

export default function DocsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white/70">
      <Link href="/" className="mb-8 inline-block text-xs font-semibold uppercase tracking-widest text-white/30 hover:text-white/60">
        &larr; Back to game
      </Link>

      <h1 className="mb-2 text-4xl font-black tracking-tight text-white">Final Third</h1>
      <p className="mb-12 text-lg text-white/50">
        Technical documentation &mdash; TxODDS World Cup Hackathon, Track 2: Consumer &amp; Fan Experiences
      </p>

      <div className="space-y-14">
        {/* ------------------------------------------------------------------ */}
        <Section title="Core Idea">
          <p>
            Live soccer feeds carry the tension of the match as structured events &mdash; possession,
            danger phases, escalation. Final Third collapses overlapping danger signals into a single
            prediction round: when a team&rsquo;s pressure hits <em>danger</em> or <em>high danger</em>,
            you get ~4 seconds to call <strong>ATTACK</strong> (this pressure produces a shot, corner, or
            goal) or <strong>DEFENSE</strong> (the defense clears it). The phase plays out entirely
            event-driven &mdash; 2 to 58 seconds, never clock-driven &mdash; and your streak lives or dies on
            whether you read the pressure correctly.
          </p>
          <p>
            Every call is graded against the verified TxLINE scores feed. No polling, no manual scoring,
            no ambiguity about who called what when. The relay server is the single source of truth for
            the round lifecycle and the grade. During quiet spells or half-time, a secondary
            &ldquo;market call&rdquo; round (higher/lower on a live odds market) keeps the screen alive.
          </p>
          <p>
            No money, no wagering, ever. The Solana wallet connection exists purely for persistent
            leaderboard identity &mdash; no transactions are ever signed.
          </p>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="Architecture">
          <div className="overflow-x-auto rounded-xl bg-white/5 p-5 font-mono text-xs leading-relaxed text-white/60">
            <pre>{`                 ┌──────────────────────────────────────────┐
                 │            Relay (Node/TS)                │
                 │       persistent process, not serverless  │
                 │                                           │
  TxLINE ──────► │  FeedSource ──► RoundEngine ──► GameRoom  │ ──► Browser
  (devnet)       │  (Live or       (pure,          (SSE +    │     (Next.js)
                 │   Replay)        deterministic)  REST)    │
                 │                       │                    │
                 │                       ▼                    │
                 │              LeaderboardStore              │
                 │           (Redis, or in-memory)            │
                 └──────────────────────────────────────────┘`}</pre>
          </div>

          <div className="space-y-3 text-sm">
            <p>
              <strong className="text-white/90">FeedSource</strong> &mdash; A single interface with two
              implementations: <code className="text-emerald-400/80">LiveSource</code> (SSE
              from <code className="text-emerald-400/80">/api/scores/stream</code>, filtered
              by FixtureId) and <code className="text-emerald-400/80">ReplaySource</code> (recorded
              JSONL replayed at configurable speed). Everything downstream is agnostic to which is
              running. This is the dev environment, demo engine, and post-deadline survival plan in one
              abstraction.
            </p>
            <p>
              <strong className="text-white/90">RoundEngine</strong> &mdash; Pure, deterministic round
              lifecycle: danger trigger &rarr; 4s lock window &rarr; event-driven resolution &rarr; 60s
              timeout backstop. No I/O, no timers &mdash; driven by explicit timestamps, unit-tested
              against recorded fixtures.
            </p>
            <p>
              <strong className="text-white/90">GameRoom</strong> &mdash; Owns the FeedSource &rarr;
              RoundEngine pipeline, fans events to connected browsers over SSE, grades guesses
              server-side, persists streaks to Redis (or in-memory).
            </p>
            <p>
              <strong className="text-white/90">Web client</strong> &mdash; Next.js + React + TypeScript +
              Tailwind + Framer Motion. Solana wallet-connect sign-up (pubkey = identity). Server-rendered
              PNG share cards via Satori / <code className="text-emerald-400/80">next/og</code>.
            </p>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="Business Highlights">
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-white/5 p-5">
              <h3 className="mb-2 text-base font-bold text-white/90">Primary: B2B white-label</h3>
              <p>
                White-label to sportsbook and media operators as a no-stakes engagement and acquisition
                product. TxODDS&rsquo;s customers are exactly the operators who want a free, compliant,
                zero-regulatory-friction way to keep users engaged during a match without every product
                surface being a bet slip. The core loop &mdash; collapse a live feed into a short,
                gradeable prediction &mdash; is generic to any sport with structured possession/pressure
                events and a natural top-of-funnel for real-money products.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-5">
              <h3 className="mb-2 text-base font-bold text-white/90">Secondary: Sponsored match rooms</h3>
              <p>
                Brand-sponsored themed rooms for marquee fixtures (broadcaster, telco, sponsor). Same
                mechanic, sponsor branding on the theme layer &mdash; no product changes required since
                team theming is already config-driven.
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="Technical Highlights">
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-white/5 p-5">
              <h3 className="mb-2 text-base font-bold text-white/90">The time-domain problem</h3>
              <p>
                Replayed historical <code className="text-emerald-400/80">Ts</code> values are real
                match-time milliseconds &mdash; not wall-clock. Replaying at 20x for dev compresses a
                4-second lock window to 200ms of real time. <code className="text-emerald-400/80">FeedSource</code> exposes
                both <code className="text-emerald-400/80">now()</code> (feed-domain time, used by the
                engine) and <code className="text-emerald-400/80">realMsUntil(ts)</code> (wall-clock ms
                remaining, used for the client countdown). The client only ever
                diffs against <code className="text-emerald-400/80">lockDeadlineRealMs</code>, never
                raw <code className="text-emerald-400/80">lockDeadlineTs</code> &mdash; that decoupling is
                what lets the same client code work at any replay speed.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-5">
              <h3 className="mb-2 text-base font-bold text-white/90">Server-authoritative grading</h3>
              <p>
                The round lifecycle, guess timestamps, and grading are entirely server-side.
                The relay records <code className="text-emerald-400/80">submittedTs</code> using its own
                clock at receipt time, and <code className="text-emerald-400/80">gradeGuess()</code> (a
                pure function of Round + PlayerGuess) is the only thing that decides WIN/LOSS/PASS/VOID.
                The client never grades its own guess &mdash; it just renders whatever the server sends.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-5">
              <h3 className="mb-2 text-base font-bold text-white/90">Reliability guard</h3>
              <p>
                The TxLINE feed can emit <code className="text-emerald-400/80">suspend</code> /
                unreliable events signaling data-quality interruptions. The round engine pauses new-round
                triggers during these windows and auto-clears after 10 seconds if no explicit
                &ldquo;reliable&rdquo; signal arrives &mdash; matching the observed real-data behavior
                where <code className="text-emerald-400/80">suspend</code> fires as a bare momentary event.
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="TxLINE Endpoints Used">
          <p className="mb-4 text-sm">
            All requests against <code className="text-emerald-400/80">https://txline-dev.txodds.com</code>.
            Auth: <code className="text-emerald-400/80">Authorization: Bearer &lt;jwt&gt;</code> +
            <code className="text-emerald-400/80"> X-Api-Token: &lt;token&gt;</code> on every request.
            The API token is server-side only and never reaches the browser.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-white/40">
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <EndpointRow
                  method="POST"
                  path="/auth/guest/start"
                  purpose="Guest JWT acquisition. Short-lived, refreshed automatically on 401."
                />
                <EndpointRow
                  method="GET"
                  path="/api/scores/historical/{fixtureId}"
                  purpose="Historical replay source. Returns the full match as an SSE-formatted string (not a real stream). Used to record fixtures for offline replay."
                />
                <EndpointRow
                  method="GET"
                  path="/api/scores/stream"
                  purpose="Live SSE scores stream. Global across all live fixtures — filtered by FixtureId client-side. Carries bare keepalive pings between events."
                />
                <EndpointRow
                  method="GET"
                  path="/api/odds/stream"
                  purpose="Live odds SSE stream. Used for lull-fallback rounds (higher/lower market calls during quiet periods)."
                />
                <EndpointRow
                  method="GET"
                  path="/api/odds/snapshot/{fixtureId}"
                  purpose="Point-in-time odds snapshot. Fallback for when stream reconnection is needed."
                />
              </tbody>
            </table>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="Round Lifecycle">
          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>
              <strong className="text-white/90">Trigger</strong> &mdash;{" "}
              <code className="text-emerald-400/80">danger_possession</code> or{" "}
              <code className="text-emerald-400/80">high_danger_possession</code> for a team, with no
              round currently open. Overlapping danger signals collapse into the same round.
            </li>
            <li>
              <strong className="text-white/90">Lock window</strong> &mdash; 4 seconds from trigger
              (real wall-clock, translated from the feed&rsquo;s time domain
              via <code className="text-emerald-400/80">FeedSource.realMsUntil()</code>).
            </li>
            <li>
              <strong className="text-white/90">Resolution</strong> &mdash; Event-driven. First
              matching confirmed event wins: goal/penalty (jackpot), shot/corner (attack win), free kick
              by attacker (minor attack win), safe possession/goal kick by defender (defense win).
            </li>
            <li>
              <strong className="text-white/90">Timeout backstop</strong> &mdash; 60s with no resolution
              voids the round. No streak change.
            </li>
            <li>
              <strong className="text-white/90">Reliability guard</strong> &mdash; Feed suspend/unreliable
              events pause new-round triggers until cleared. Doesn&rsquo;t affect an already-open
              round&rsquo;s resolution.
            </li>
          </ol>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="API Observations">
          <p className="mb-4 text-sm">
            Notes from building against real fixture data (France&ndash;Spain semi, England&ndash;Argentina
            semi &mdash; ~2,000 messages total):
          </p>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-white/5 p-4">
              <strong className="text-white/80">Score/Clock shapes differ from spec prose</strong>
              <p className="mt-1">
                <code className="text-emerald-400/80">Score</code> is keyed{" "}
                <code className="text-emerald-400/80">Participant1/Participant2</code> (not &ldquo;1&rdquo;/&ldquo;2&rdquo;),
                nested by period (<code className="text-emerald-400/80">H1/HT/H2/Total</code>) before
                Goals/Corners/YellowCards. <code className="text-emerald-400/80">Clock</code> is{" "}
                <code className="text-emerald-400/80">{`{ Running: boolean, Seconds: number }`}</code>,
                not a formatted string.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <strong className="text-white/80">Live stream is global, not fixture-scoped</strong>
              <p className="mt-1">
                <code className="text-emerald-400/80">/api/scores/stream</code> carries events for every
                live fixture simultaneously. Consumer must filter by{" "}
                <code className="text-emerald-400/80">FixtureId</code>. Keepalive pings use seconds
                (not ms) for their <code className="text-emerald-400/80">Ts</code> field.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <strong className="text-white/80">Historical endpoint has a post-match delay</strong>
              <p className="mt-1">
                Fixtures that just finished return empty responses. The documented 6h&ndash;2wk window
                has an undocumented processing delay at the start.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <strong className="text-white/80">Suspend events are bare</strong>
              <p className="mt-1">
                Spec says they carry Unreliable/Reliable flags. Real data shows neither &mdash; just a bare{" "}
                <code className="text-emerald-400/80">{`{Action:"suspend",Confirmed:true}`}</code> with
                normal events resuming immediately after.
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        <Section title="Running Locally">
          <div className="overflow-x-auto rounded-xl bg-white/5 p-5 font-mono text-sm leading-relaxed text-white/60">
            <pre>{`npm install                 # installs shared + relay
npm run install:web         # installs the web package (bun)
npm run build:shared

# Replay mode (default, no credentials needed)
npm run dev:relay           # starts relay on :4000
npm run dev:web             # starts Next.js on :3000

# Live mode (needs TXLINE_API_TOKEN in packages/relay/.env)
FEED_MODE=live LIVE_FIXTURE_ID=<id> npm run dev:relay`}</pre>
          </div>
        </Section>
      </div>

      <footer className="mt-20 border-t border-white/5 pt-8 text-center text-xs text-white/25">
        Built for the TxODDS World Cup Hackathon &mdash; Track 2: Consumer &amp; Fan Experiences
      </footer>
    </main>
  );
}
