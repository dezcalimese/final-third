"use client";

import { useEffect, useState } from "react";

/** Forces a re-render every `intervalMs` so countdown/elapsed-time UI stays live. */
export function useNow(intervalMs = 150): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
