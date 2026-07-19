"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MatchPicker } from "@/components/MatchPicker";

const Game = dynamic(() => import("@/components/Game").then((m) => m.Game), { ssr: false });
const SoccerBallField = dynamic(
  () => import("@/components/SoccerBallField").then((m) => m.SoccerBallField),
  { ssr: false }
);

export default function Home() {
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);

  if (selectedFixture) {
    return <Game fixtureId={selectedFixture} onBack={() => setSelectedFixture(null)} />;
  }

  return (
    <>
      <SoccerBallField />
      <MatchPicker onSelect={setSelectedFixture} />
    </>
  );
}
