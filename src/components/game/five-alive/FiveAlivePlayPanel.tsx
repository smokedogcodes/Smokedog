"use client";

import { useCallback, useRef } from "react";
import type { PublicGameState } from "@/lib/types";
import { FiveAliveFlyingCard } from "@/components/mockups/five-alive/FiveAliveFlyingCard";
import { FiveAliveBombPanel } from "./FiveAliveBombPanel";
import { FiveAliveDealingPanel } from "./FiveAliveDealingPanel";
import { FiveAliveTurnPanel } from "./FiveAliveTurnPanel";
import { useFiveAliveDealing } from "./useFiveAliveDealing";

/**
 * Single play shell for turn / bomb / dealing so deal animations are not
 * torn down when the server switches phase before the last card lands.
 */
export function FiveAlivePlayPanel({
  state,
  paused,
  onPlay,
  onRespond,
  onInviteVoice,
}: {
  state: PublicGameState;
  paused?: boolean;
  onPlay: (payload: { cardId?: string; pass?: boolean }) => void;
  onRespond: (payload: { cardId?: string | null; pass?: boolean }) => void;
  onInviteVoice?: (playerId: string) => void;
}) {
  const five = state.fiveAlive;
  const you = state.you;
  const drawRef = useRef<HTMLDivElement | null>(null);
  const handTargetRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerSeatRef = useCallback(
    (playerId: string, el: HTMLElement | null) => {
      if (el) seatRefs.current.set(playerId, el);
      else seatRefs.current.delete(playerId);
    },
    []
  );

  const phase = state.phase;

  const dealing = useFiveAliveDealing({
    dealEvent: five?.dealEvent,
    phase,
    youId: you?.id ?? null,
    drawRef,
    handTargetRef,
    seatRefs,
  });

  const showDealingLayout =
    phase === "fivealive_dealing" || dealing.flies.length > 0;

  return (
    <div className="relative min-w-0 overflow-x-hidden">
      {showDealingLayout ? (
        <FiveAliveDealingPanel
          state={state}
          dealing={dealing}
          drawRef={drawRef}
          handTargetRef={handTargetRef}
          registerSeatRef={registerSeatRef}
          onInviteVoice={onInviteVoice}
        />
      ) : phase === "fivealive_bomb" ? (
        <FiveAliveBombPanel
          state={state}
          paused={paused}
          onRespond={onRespond}
          onInviteVoice={onInviteVoice}
        />
      ) : (
        <FiveAliveTurnPanel
          state={state}
          paused={paused}
          onPlay={onPlay}
          onInviteVoice={onInviteVoice}
        />
      )}

      {dealing.flies.map((flight) => (
        <FiveAliveFlyingCard
          key={flight.id}
          payload={flight}
          onComplete={() => dealing.onFlyComplete(flight.id)}
        />
      ))}
    </div>
  );
}
