"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { FiveAliveDeckCard, FiveAliveDeckCardBack } from "./FiveAliveDeckCard";
import type { PublicFiveAliveCard } from "@/lib/types";
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

export function FiveAliveFlyingCard({
  payload,
  onComplete,
}: {
  payload: FlyPayload;
  onComplete: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const duration = (payload.kind === "play" ? FA_PLAY_MS : FA_DRAW_MS) / 1000;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isBack =
    payload.kind === "draw" ||
    (payload.kind === "deal" && !payload.flipToFace);

  return createPortal(
    <motion.div
      className="pointer-events-none fixed z-[9999]"
      initial={{
        left: payload.from.left,
        top: payload.from.top,
        width: payload.from.width,
        height: payload.from.height,
        rotate: payload.kind === "play" ? 0 : -6,
      }}
      animate={{
        left: payload.to.left,
        top: payload.to.top,
        width: payload.to.width,
        height: payload.to.height,
        rotate: payload.kind === "play" ? 4 : payload.kind === "deal" ? 2 : 0,
      }}
      transition={{ duration, ease: FA_EASE }}
      onAnimationComplete={onComplete}
    >
      {isBack ? (
        <FiveAliveDeckCardBack width={payload.from.width} />
      ) : (
        <FiveAliveDeckCard
          card={payload.card}
          width={payload.from.width}
          elevated
        />
      )}
    </motion.div>,
    document.body
  );
}
