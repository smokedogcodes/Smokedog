"use client";

import { useEffect, useRef } from "react";
import type { PublicFiveAliveCard, PublicGameState } from "@/lib/types";
import { GlassPanel } from "@/components/ui/primitives";
import {
  canPlayFiveAliveCardAtTotal,
  handHasPlayableCard,
} from "@/lib/games/5-alive/rules";
import { FiveAliveFlyingCard } from "@/components/mockups/five-alive/FiveAliveFlyingCard";
import { FiveAliveHand } from "./FiveAliveHand";
import {
  FA_BOARD_PANEL_CLASS,
  FA_BOARD_PANEL_STYLE,
  FA_HAND_PANEL_CLASS,
  FA_HAND_PANEL_STYLE,
  FiveAliveLifeTracker,
} from "./FiveAliveTable";
import { useFiveAliveCardFly } from "./useFiveAliveCardFly";
import { useFiveAliveLifeLoss } from "./useFiveAliveLifeLoss";

export function FiveAliveTurnPanel({
  state,
  paused = false,
  onPlay,
  onInviteVoice,
}: {
  state: PublicGameState;
  paused?: boolean;
  onPlay: (payload: { cardId?: string; pass?: boolean }) => void;
  onInviteVoice?: (playerId: string) => void;
}) {
  const five = state.fiveAlive;
  const you = state.you;

  const yourTurn = !!five && five.turnPlayerId === you?.id;
  const youAlive = !!you?.alive;
  const { lifeAnim, actionsBlocked } = useFiveAliveLifeLoss(state.players);
  const autoPassKeyRef = useRef<string | null>(null);

  const {
    fly,
    hiddenCardId,
    centerPlaceholder,
    isBusy,
    centerRef,
    registerCardRef,
    startPlayFly,
    onFlyComplete,
  } = useFiveAliveCardFly();

  const yourHand = five?.yourHand ?? [];
  const runningTotal = five?.runningTotal ?? 0;
  const turnPlayerId = five?.turnPlayerId ?? null;

  const atTwentyOne = runningTotal === 21;
  const locked = !yourTurn || !youAlive || isBusy || actionsBlocked || paused;
  const hasPlayableCard = handHasPlayableCard(yourHand, runningTotal);
  const autoStuck = yourTurn && youAlive && yourHand.length > 0 && !hasPlayableCard;
  const handKey = yourHand.map((c) => c.id).join(",");

  useEffect(() => {
    if (!five || !autoStuck || locked || paused) return;
    const key = `${turnPlayerId}-${runningTotal}-${handKey}`;
    if (autoPassKeyRef.current === key) return;
    autoPassKeyRef.current = key;
    onPlay({ pass: true });
  }, [five, autoStuck, locked, paused, turnPlayerId, runningTotal, handKey, onPlay]);

  if (!five) return null;

  const playableFilter = (card: PublicFiveAliveCard) =>
    canPlayFiveAliveCardAtTotal(card, five.runningTotal);

  const handleSelect = (card: PublicFiveAliveCard) => {
    if (locked) return;
    if (!canPlayFiveAliveCardAtTotal(card, five.runningTotal)) return;
    startPlayFly(card, () => onPlay({ cardId: card.id }));
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <GlassPanel className={`${FA_BOARD_PANEL_CLASS} p-2 sm:p-3`} style={FA_BOARD_PANEL_STYLE}>
        {five.pendingDrawCount > 0 ? (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#457b9d]">
            Next draws {five.pendingDrawCount}, then turn passes
          </p>
        ) : null}
        {autoStuck ? (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#8B1E1E]">
            No playable cards — losing 1 life…
          </p>
        ) : null}
        {yourTurn && atTwentyOne && !autoStuck ? (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#457b9d]">
            Total is 21 — play 0, =0/=10/=21, or an action
          </p>
        ) : null}

        <FiveAliveLifeTracker
          players={state.players}
          turnPlayerId={five.turnPlayerId}
          direction={five.direction}
          skipNext={five.skipNext}
          lifeAnim={lifeAnim}
          youId={you?.id ?? null}
          onInviteVoice={onInviteVoice}
          five={five}
          centerRef={(el) => {
            centerRef.current = el;
          }}
          centerPlaceholder={centerPlaceholder}
        />
      </GlassPanel>

      <GlassPanel
        className={`${FA_HAND_PANEL_CLASS} p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4`}
        style={FA_HAND_PANEL_STYLE}
      >
        <h3 className="font-sans text-base font-bold uppercase tracking-wide text-[#7D2D2D] sm:text-xl">
          Your hand
        </h3>
        {!yourTurn && (
          <p className="mt-1 text-xs text-[#7D2D2D]/70 sm:text-sm">Locked until your turn.</p>
        )}
        {yourTurn && !youAlive && (
          <p className="mt-1 text-xs text-[#7D2D2D]/70 sm:text-sm">Eliminated — spectating.</p>
        )}
        {paused && (
          <p className="mt-1 text-xs text-[#8B1E1E] sm:text-sm">Paused — host must resume.</p>
        )}
        {actionsBlocked && (
          <p className="mt-1 text-xs text-[#8B1E1E] sm:text-sm">Life lost — wait for the flip…</p>
        )}

        <div className="mt-2 pt-1 sm:mt-4">
          <FiveAliveHand
            cards={yourHand}
            disabled={locked || autoStuck}
            hiddenCardId={hiddenCardId}
            playableFilter={yourTurn ? playableFilter : undefined}
            registerCardRef={registerCardRef}
            onSelect={handleSelect}
          />
        </div>
      </GlassPanel>

      {fly ? (
        <FiveAliveFlyingCard payload={fly} onComplete={onFlyComplete} />
      ) : null}
    </div>
  );
}
