# Demo Video Outline (≤5 min)

## 0:00–0:30 — The problem

Cold open on a match clip (muted) with no game overlay — just watching. Voiceover:
"Watching a match alone is passive. You see the danger building but you have no way
to say what you think happens next." Cut to Final Third loading, France v Spain.

## 0:30–1:30 — The loop, round one (a quick strike)

Screen-record a live play session. Possession bar is visibly alive throughout — call
out in voiceover that it's driven by the feed's own possession-state heartbeat, not
decorative animation. A danger phase triggers: ATTACK/DEFENSE cards appear, 4-second
lock countdown visible. Tap a pick. Phase resolves in ~5 seconds (a "quick strike,"
matching the measured p25/median). Reveal beat: sharp flash, WIN/LOSS shown, streak
ticks up.

## 1:30–3:00 — Round two, the long siege with a late flip

A danger phase triggers and locks in. Let it run long — 30–45 seconds — showing the
escalation: color temperature shifting toward the attacking team, pulsing pressure
meter, border intensity compounding. Voiceover over this: "The bimodal rhythm is the
point — most phases snap in under 10 seconds, but the occasional 40-second siege is
where the tension actually lives, and we never cut one short for pacing." Round
resolves late with an outcome that flips the "obvious" read (e.g. defense holds for
35 seconds then concedes a shot) — show the reveal.

## 3:00–3:30 — The streak break (the designed heartbeat moment)

Show or cut to a goal breaking a defense-pick streak — the jackpot celebration
treatment plays regardless of which side wins, so a defense-picker sees the "Messi
cross at the death" heartbreak beat: streak resets to zero, visibly and with sting
(color flash + scale-down, never a shake — call out the no-screen-shake
accessibility decision explicitly). This is the moment the whole tension system is
built around.

## 3:30–4:00 — Share card

Tap Share. Show the in-app preview (streak, accuracy, matchup, "beat X% of players"
pulled from the real leaderboard), then the downloaded PNG side by side. Mention it's
server-rendered via Satori from the exact same component as the in-app card.

## 4:00–4:30 — Live input (one shot)

Cut to a terminal window: `FEED_MODE=live npm run dev:relay` connecting to the actual
TxLINE live stream, showing real messages scrolling (`danger_possession`, `shot`,
etc. with real `Ts`/`Participant` values). Voiceover: "This is the live TxLINE
connection — the same round engine, same relay, same client, just a different
`FeedSource` behind the scenes." No need to play a full round live on camera; the
point is proving the live path is real, not simulated.

## 4:30–5:00 — Close

Quick montage: wallet connect, leaderboard panel, half-time market-call round (the
lull fallback). Final card: "Free. No stakes. Every call graded against the verified
TxLINE feed." End on the deployed URL.

## Shot list checklist

- [ ] One full quick-strike round (trigger → lock → resolve, under ~10s)
- [ ] One full long-siege round (30s+), showing escalation compounding
- [ ] One goal/penalty jackpot reveal, ideally breaking a streak
- [ ] Share card: in-app preview + downloaded PNG
- [ ] Terminal shot of `FEED_MODE=live` connected, real messages flowing
- [ ] Wallet connect flow
- [ ] Leaderboard panel
- [ ] Half-time or quiet-spell lull round (higher/lower on a market)
