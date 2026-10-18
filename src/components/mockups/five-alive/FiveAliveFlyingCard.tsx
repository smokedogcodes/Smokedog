"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { FiveAliveDeckCard, FiveAliveDeckCardBack } from "./FiveAliveDeckCard";
import type { PublicFiveAliveCard } from "@/lib/types";
import { FA_DEAL_CARD_MS } from "@/lib/games/5-alive/dealing";
import { FA_EASE, FA_DRAW_MS, FA_PLAY_MS } from "./FiveAliveTableAnimation";

export type FlyRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FlyPayload = {
  card: PublicFiveAliveCard;
  from: FlyRect;
  to: FlyRect;
  kind: "play" | "draw" | "deal";
  /** Flip face-up on land (local player deal). */
  flipToFace?: boolean;
};

function flyDurationSec(kind: FlyPayload["kind"]): number {
  if (kind === "play") return FA_PLAY_MS / 1000;
  if (kind === "deal") return FA_DEAL_CARD_MS / 1000;
  return FA_DRAW_MS / 1000;
}

export function FiveAliveFlyingCard({
  payload,
  onComplete,
}: {
  payload: FlyPayload;
  onComplete: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [faceUp, setFaceUp] = useState(
    !(
      payload.kind === "draw" ||
      (payload.kind === "deal" && !payload.flipToFace)
    )
  );
  const duration = flyDurationSec(payload.kind);
  // Keep a readable card size throughout deal flights (origin used to be 1px).
  const cardW =
    payload.kind === "deal"
      ? Math.max(40, Math.round((payload.from.width + payload.to.width) / 2))
      : Math.max(payload.from.width, 1);
  const cardH = (cardW * 7) / 5;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (payload.kind !== "deal" || !payload.flipToFace) return;
    // Flip near the end of the flight so the deal reads as backs leaving the hub.
    const t = window.setTimeout(() => setFaceUp(true), duration * 1000 * 0.62);
    return () => window.clearTimeout(t);
  }, [payload.kind, payload.flipToFace, duration]);

  if (!mounted) return null;

  const showBack = !faceUp;

  return createPortal(
    <motion.div
      className="pointer-events-none fixed z-[9999]"
      initial={{
        left: payload.from.left,
        top: payload.from.top,
        width: cardW,
        height: cardH,
        rotate: payload.kind === "deal" ? -12 : payload.kind === "play" ? 0 : -6,
        scale: payload.kind === "deal" ? 0.92 : 1,
        opacity: 1,
      }}
      animate={{
        left: payload.to.left,
        top: payload.to.top,
        width: cardW,
        height: cardH,
        rotate: payload.kind === "deal" ? 8 : payload.kind === "play" ? 4 : 0,
        scale: 1,
        opacity: 1,
      }}
      transition={{ duration, ease: FA_EASE }}
      onAnimationComplete={onComplete}
    >
      {showBack ? (
        <FiveAliveDeckCardBack width={cardW} className="shadow-xl" />
      ) : (
        <FiveAliveDeckCard
          card={payload.card}
          width={cardW}
          elevated
          className="shadow-xl"
        />
      )}
    </motion.div>,
    document.body
  );
}
