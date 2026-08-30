"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicGameState } from "@/lib/types";

const LIFE_LOSS_MS = 1800;

export function useFiveAliveLifeLoss(players: PublicGameState["players"]) {
  const prevLivesRef = useRef<Map<string, number>>(new Map());
  const [lifeAnim, setLifeAnim] = useState<{ playerId: string; slot: number } | null>(
    null
  );
  const [actionsBlocked, setActionsBlocked] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    for (const p of players) {
      const prev = prevLivesRef.current.get(p.id);
      const next = p.lives ?? 0;

      if (prev !== undefined && next < prev) {
        setLifeAnim({ playerId: p.id, slot: next });
        setActionsBlocked(true);
        timer = setTimeout(() => {
          setLifeAnim(null);
          setActionsBlocked(false);
        }, LIFE_LOSS_MS);
      }

      prevLivesRef.current.set(p.id, next);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [players]);

  return { lifeAnim, actionsBlocked, lifeLossMs: LIFE_LOSS_MS };
}
