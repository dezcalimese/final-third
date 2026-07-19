import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWN_FIXTURES } from "@final-third/shared";
import { TxLineAuth } from "../txlineAuth.js";
import { parseSseString } from "../sseParse.js";
import { capLargeGaps } from "../timeGaps.js";

/**
 * Urgent, independent of the rest of the build (§7 step 1): pull the raw historical
 * feed for every known fixture and save it to data/raw/*.jsonl NOW. The devnet free
 * data window is 6h-2wk after kickoff and closes for good on July 19 — after that,
 * these JSONL files are the only source of truth this project has.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../../data/raw");

async function main() {
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!apiToken) {
    console.error(
      "TXLINE_API_TOKEN is not set. Set it in packages/relay/.env (copy from .env.example) " +
        "before running this script — the token is required to fetch real fixture data " +
        "and must never be committed or shipped to the browser."
    );
    process.exit(1);
  }

  const baseUrl = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
  const auth = new TxLineAuth(baseUrl, apiToken);
  const client = auth.client();
  const requestedIds = new Set(process.argv.slice(2));
  const fixtures = requestedIds.size > 0
    ? KNOWN_FIXTURES.filter((fixture) => requestedIds.has(fixture.fixtureId))
    : KNOWN_FIXTURES;

  if (requestedIds.size > 0 && fixtures.length !== requestedIds.size) {
    const knownIds = new Set(fixtures.map((fixture) => fixture.fixtureId));
    const unknownIds = [...requestedIds].filter((fixtureId) => !knownIds.has(fixtureId));
    throw new Error(`Unknown fixture id(s): ${unknownIds.join(", ")}`);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  for (const fixture of fixtures) {
    const outPath = path.join(DATA_DIR, `${fixture.fixtureId}.jsonl`);
    console.log(`Fetching ${fixture.label} (${fixture.fixtureId})...`);
    try {
      const res = await client.get(`/api/scores/historical/${fixture.fixtureId}`, {
        transformResponse: [(d) => d],
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { Accept: "text/event-stream" },
      });

      const raw = res.data as string;
      const messages = parseSseString(raw);

      if (messages.length === 0) {
        console.warn(
          `  WARNING: parsed 0 messages for ${fixture.fixtureId}. Fixture may be outside the ` +
            `6h-2wk replay window, or the response shape differs from the documented format. ` +
            `Raw response length: ${raw?.length ?? 0} chars. Skipping write.`
        );
        continue;
      }

      messages.sort((a, b) => a.Ts - b.Ts);
      capLargeGaps(messages);
      const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
      fs.writeFileSync(outPath, jsonl, "utf8");
      console.log(`  Saved ${messages.length} messages -> ${outPath}`);
    } catch (err: any) {
      console.error(
        `  FAILED to fetch ${fixture.fixtureId}: ${err?.response?.status ?? ""} ${err?.message ?? err}`
      );
    }
  }

  console.log("Done. Commit data/raw/*.jsonl immediately — this is the post-deadline survival plan.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
