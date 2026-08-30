"use client";

import { useCallback, useEffect, useState } from "react";
import { loadKnowGame, saveKnowGame } from "@/lib/know-game";

export function useKnowGame() {
  const [knowGame, setKnowGameState] = useState(false);

  useEffect(() => {
    setKnowGameState(loadKnowGame());
  }, []);

  const setKnowGame = useCallback((value: boolean) => {
    setKnowGameState(value);
    saveKnowGame(value);
  }, []);

  return [knowGame, setKnowGame] as const;
}
