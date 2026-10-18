"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Ref } from "react";
import type { PublicGameState } from "@/lib/types";
import { GlassPanel } from "@/components/ui/primitives";
import { FA_EASE } from "@/components/mockups/five-alive/FiveAliveTableAnimation";
import {
  FA_BOARD_PANEL_CLASS,
  FA_BOARD_PANEL_STYLE,
  FA_HAND_PANEL_CLASS,
  FA_HAND_PANEL_STYLE,
  FiveAliveLifeTracker,
} from "./FiveAliveTable";
import { FiveAliveHand } from "./FiveAliveHand";
import type { useFiveAliveDealing } from "./useFiveAliveDealing";

type DealingState = ReturnType<typeof useFiveAliveDealing>;

export function FiveAliveDealingPanel({
  state,
  dealing,
  drawRef,
  handTargetRef,
  registerSeatRef,
  onInviteVoice,
}: {
  state: PublicGameState;
  dealing: DealingState;
  drawRef: Ref<HTMLDivElement>;
  handTargetRef: Ref<HTMLDivElement>;
  registerSeatRef: (playerId: string, el: HTMLElement | null) => void;
  onInviteVoice?: (playerId: string) => void;
}) {
  const five = state.fiveAlive;
  const you = state.you;

  const {
    bannerVisible,
    bannerText,
    isDealing,
    revealedLocalCards,
    dealPileRemaining,
  } = dealing;

  if (!five) return null;

  const isShuffleDeal = five.dealEvent?.kind === "shuffle";

  const tableFive = {
    ...five,
    runningTotal: isShuffleDeal ? 0 : five.runningTotal,
    drawPileCount: five.dealEvent ? dealPileRemaining : five.drawPileCount,
  };

  return (
    <div className="relative space-y-3 sm:space-y-4">
      <AnimatePresence>
        {bannerVisible && bannerText ? (
          <motion.div
            key="deal-banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: FA_EASE }}
            className="pointer-events-none fixed inset-x-0 top-[max(5rem,env(safe-area-inset-top))] z-[8000] flex justify-center px-3 sm:top-24 sm:px-4"
          >
            <div className="rounded-sm border border-[#8B1E1E]/30 bg-manila/95 px-4 py-2.5 shadow-lg backdrop-blur-sm sm:px-6 sm:py-3">
              <p className="font-display text-lg font-bold text-[#8B1E1E] sm:text-xl">
                {bannerText}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <GlassPanel className={`${FA_BOARD_PANEL_CLASS} p-2 sm:p-3`} style={FA_BOARD_PANEL_STYLE}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          {isDealing ? "Dealing…" : "Preparing table"}
        </p>
        <p className="mt-1 text-sm text-ink-steel">
          {isShuffleDeal
            ? "Hands shuffled — dealing from the next player…"
            : "Cards are being dealt from the draw pile. Please wait…"}
        </p>

        <div className="mt-2 sm:mt-3">
          <FiveAliveLifeTracker
            players={state.players}
            turnPlayerId={five.turnPlayerId}
            direction={five.direction}
            skipNext={five.skipNext}
            registerSeatRef={registerSeatRef}
            youId={you?.id ?? null}
            onInviteVoice={onInviteVoice}
            five={tableFive}
            drawRef={drawRef}
          />
        </div>
      </GlassPanel>

      <GlassPanel
        className={`${FA_HAND_PANEL_CLASS} p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4`}
        style={FA_HAND_PANEL_STYLE}
      >
        <h3 className="font-sans text-base font-bold uppercase tracking-wide text-[#7D2D2D] sm:text-xl">
          Your hand
        </h3>
        <p className="mt-1 text-xs text-[#7D2D2D]/70 sm:text-sm">Cards arriving…</p>
        <div
          ref={handTargetRef}
          className="relative mt-3 min-h-[100px] pt-1 sm:mt-4 sm:min-h-[120px]"
        >
          {revealedLocalCards.length > 0 ? (
            <FiveAliveHand cards={revealedLocalCards} disabled />
          ) : (
            <div className="flex min-h-[100px] items-center justify-center rounded-sm border border-dashed border-[#7D2D2D]/25 bg-[rgba(125,45,45,0.03)] sm:min-h-[120px]">
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#7D2D2D]/60">
                Waiting for cards
              </p>
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
