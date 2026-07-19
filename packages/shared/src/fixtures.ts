export interface KnownFixture {
  fixtureId: string;
  home: string;
  away: string;
  label: string;
}

/**
 * Known devnet fixtures (§4). Participant 1/2 <-> home/away is read directly off the
 * feed's own `Participant1IsHome` flag, present on every message (confirmed against
 * real data — see FEEDBACK.md); this map only supplies the human-readable team names
 * for theming, and its home/away columns line up with the real `Participant1IsHome`
 * value observed for the two fixtures that have real data.
 *
 * Real replay data imported (`data/raw/{id}.jsonl`): 18237038, 18241006, and
 * 18257865. Fixture 18257739 is consumed from the live stream while available.
 */
export const KNOWN_FIXTURES: KnownFixture[] = [
  { fixtureId: "18237038", home: "France", away: "Spain", label: "France v Spain (Semi-final)" },
  { fixtureId: "18241006", home: "England", away: "Argentina", label: "England v Argentina (Semi-final)" },
  { fixtureId: "18257739", home: "Spain", away: "Argentina", label: "Spain v Argentina (Final)" },
  { fixtureId: "18257865", home: "France", away: "England", label: "France v England (3rd place)" },
];

export function getKnownFixture(fixtureId: string): KnownFixture | undefined {
  return KNOWN_FIXTURES.find((f) => f.fixtureId === fixtureId);
}
