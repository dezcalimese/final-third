/**
 * Real pulls include pre-match broadcast-coverage setup messages that can precede
 * kickoff by DAYS (observed: a ~92-hour gap between an initial "coverage_update" and
 * the next message in a real fixture — replaying that verbatim would freeze the game
 * for hours even at high speed). Cap any single inter-message gap at this ceiling,
 * shifting every later message's Ts back by the excess. Well above any gap actually
 * observed between in-match events (rounds resolve or time out within ~90s per the
 * round engine, and adjacent danger phases are minutes apart at most) — this only
 * ever trims dead broadcast-setup air, never live match pacing. Shared by
 * fetchHistorical.ts and importRealFixture.ts so both real-data paths get it.
 */
const MAX_GAP_MS = 3 * 60_000;

export function capLargeGaps(messages: { Ts: number }[]): void {
  let compressedOffset = 0;
  let prevOriginalTs: number | null = null;
  for (const msg of messages) {
    if (prevOriginalTs !== null) {
      const gap = msg.Ts - prevOriginalTs;
      if (gap > MAX_GAP_MS) compressedOffset += gap - MAX_GAP_MS;
    }
    prevOriginalTs = msg.Ts;
    msg.Ts -= compressedOffset;
  }
}
