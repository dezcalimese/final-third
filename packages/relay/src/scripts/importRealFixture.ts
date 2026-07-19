import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSseString } from "../sseParse.js";
import { capLargeGaps } from "../timeGaps.js";

/**
 * Imports a raw .sse file (the `data: {json}\nid: N\n\n` block format — same as what
 * the historical endpoint returns per §4, confirmed against real fixture pulls) into
 * data/raw/{fixtureId}.jsonl, using the same parser fetchHistorical.ts uses against a
 * live response. Once a real .jsonl exists for a fixtureId, the relay prefers it over
 * the synthetic fallback automatically (see server.ts's resolveReplayFile).
 *
 * Usage: tsx src/scripts/importRealFixture.ts <path-to.sse> [fixtureId]
 * If fixtureId is omitted, it's inferred from the source filename (fixture_18237038.sse -> 18237038).
 */

function inferFixtureId(sourcePath: string): string {
  const base = path.basename(sourcePath, path.extname(sourcePath));
  const match = base.match(/(\d{5,})/);
  if (!match) {
    throw new Error(`Could not infer a fixtureId from "${sourcePath}" — pass it explicitly as the 2nd argument.`);
  }
  return match[1];
}

function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    console.error("Usage: tsx src/scripts/importRealFixture.ts <path-to.sse> [fixtureId]");
    process.exit(1);
  }
  const fixtureId = process.argv[3] ?? inferFixtureId(sourcePath);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DATA_DIR = path.resolve(__dirname, "../../../../data/raw");
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const raw = fs.readFileSync(sourcePath, "utf8");
  const messages = parseSseString(raw);

  if (messages.length === 0) {
    console.error(`Parsed 0 messages from ${sourcePath} — check the file is in the documented SSE-block format.`);
    process.exit(1);
  }

  messages.sort((a, b) => a.Ts - b.Ts);
  capLargeGaps(messages);
  const outPath = path.join(DATA_DIR, `${fixtureId}.jsonl`);
  fs.writeFileSync(outPath, messages.map((m) => JSON.stringify(m)).join("\n") + "\n", "utf8");
  console.log(`Imported ${messages.length} messages from ${sourcePath} -> ${outPath}`);
}

main();
