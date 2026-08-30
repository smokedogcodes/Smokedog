"use client";

import { useCallback, useState } from "react";

export const FA_DRAW_MS = 980;
export const FA_PLAY_MS = 880;
export const FA_EASE = [0.22, 1, 0.36, 1] as const;

export function useFiveAliveTableAnimation() {
  const [drawingCardId, setDrawingCardId] = useState<string | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);

  const drawCard = useCallback((cardId: string, onComplete: () => void) => {
    if (drawingCardId || playingCardId) return;
    setDrawingCardId(cardId);
    window.setTimeout(() => {
      setDrawingCardId(null);
      onComplete();
    }, FA_DRAW_MS);
  }, [drawingCardId, playingCardId]);

  const playCard = useCallback((cardId: string, onComplete: () => void) => {
    if (drawingCardId || playingCardId) return;
    setPlayingCardId(cardId);
    window.setTimeout(() => {
      setPlayingCardId(null);
      onComplete();
    }, FA_PLAY_MS);
  }, [drawingCardId, playingCardId]);

  return {
    drawingCardId,
    playingCardId,
    drawCard,
    playCard,
    isBusy: !!drawingCardId || !!playingCardId,
  };
}
