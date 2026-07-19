import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { ShareCardContent } from "@/components/ShareCardContent";

export const runtime = "nodejs";

const RELAY_URL = process.env.RELAY_URL ?? process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

/**
 * Server-rendered PNG share card (§5): fetches the same relay data the in-app
 * card preview uses, then renders the identical ShareCardContent component
 * through Satori via next/og's ImageResponse. GET /api/share?playerId=...
 */
export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  if (!playerId) {
    return new Response("playerId is required", { status: 400 });
  }

  const res = await fetch(new URL(`/api/share-data/${playerId}`, RELAY_URL).toString(), {
    cache: "no-store",
  });
  if (!res.ok) {
    return new Response("Could not load share data from relay", { status: 502 });
  }
  const data = await res.json();

  return new ImageResponse(
    (
      <ShareCardContent
        home={data.fixture.participant1}
        away={data.fixture.participant2}
        streak={data.streak}
        best={data.best}
        accuracy={data.accuracy}
        beatPercent={data.beatPercent}
      />
    ),
    { width: 1200, height: 630 }
  );
}
