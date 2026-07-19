import type { ScoreMessage } from "@final-third/shared";

/**
 * The historical scores endpoint returns the raw SSE stream as one big string
 * instead of an actual event-stream response (§4, noted again in FEEDBACK.md).
 * Blocks look like:
 *   data: {json}
 *   id: N
 *
 * Split on blank-line-delimited blocks, pull `data:` lines out, JSON.parse each.
 * A block can have a multi-line `data:` payload per the SSE spec, so we concatenate
 * consecutive `data:` lines within a block before parsing.
 */
export function parseSseString(raw: string): ScoreMessage[] {
  const messages: ScoreMessage[] = [];
  const blocks = raw.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n");
    try {
      const parsed = JSON.parse(payload);
      messages.push(parsed as ScoreMessage);
    } catch {
      // Skip malformed/heartbeat blocks rather than aborting the whole replay.
      continue;
    }
  }

  return messages;
}
