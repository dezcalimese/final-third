"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShareCardContent, type ShareCardData } from "./ShareCardContent";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";
const CARD_W = 1200;
const CARD_H = 630;

function ScaledCard({ data }: { data: ShareCardData | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    if (!wrapRef.current) return;
    setScale(wrapRef.current.offsetWidth / CARD_W);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div ref={wrapRef} className="w-full overflow-hidden" style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}>
      {data ? (
        <div
          style={{
            width: CARD_W,
            height: CARD_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <ShareCardContent {...data} />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/40">Loading…</div>
      )}
    </div>
  );
}

export function ShareCardModal({ playerId, open, onClose }: { playerId: string | null; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<ShareCardData | null>(null);

  useEffect(() => {
    if (!open || !playerId) return;
    let cancelled = false;
    fetch(new URL(`/api/share-data/${playerId}`, RELAY_URL).toString())
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData({
          home: d.fixture.participant1,
          away: d.fixture.participant2,
          streak: d.streak,
          best: d.best,
          accuracy: d.accuracy,
          beatPercent: d.beatPercent,
        });
      })
      .catch(() => setData(null));
    return () => {
      cancelled = true;
    };
  }, [open, playerId]);

  const downloadUrl = playerId ? `/api/share?playerId=${encodeURIComponent(playerId)}` : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-pitch-900"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ScaledCard data={data} />
            <div className="flex items-center justify-between gap-3 p-4">
              <button onClick={onClose} className="text-xs text-white/50">
                Close
              </button>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download="final-third-streak.png"
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-black"
                >
                  Download PNG
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
