"use client";

import { GlassPanel } from "@/components/ui/primitives";
import type { PublicGameState } from "@/lib/types";
import { FiveAliveHand } from "./FiveAliveHand";
import {
  FA_BOARD_PANEL_CLASS,
  FA_BOARD_PANEL_STYLE,
  FA_HAND_PANEL_CLASS,
  FA_HAND_PANEL_STYLE,
  FiveAliveLifeTracker,
} from "./FiveAliveTable";
import { useFiveAliveLifeLoss } from "./useFiveAliveLifeLoss";

export function FiveAliveBombPanel({
  state,
  paused = false,
  onInviteVoice,
}: {
  state: PublicGameState;
  paused?: boolean;
  /** Kept for API compat — bomb responses are auto-resolved server-side. */
  onRespond?: (payload: { cardId?: string | null; pass?: boolean }) => void;
  onInviteVoice?: (playerId: string) => void;
}) {
  const five = state.fiveAlive;
  const you = state.you;
  const { lifeAnim, actionsBlocked } = useFiveAliveLifeLoss(state.players);

  if (!five) {
    return (
      <GlassPanel className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#8B1E1E]">
          Bomb response
        </p>
        <p className="mt-2 text-sm text-ink-steel">Waiting for bomb state…</p>
      </GlassPanel>
    );
  }

  const awaitingId = five.bombAwaitingPlayerId;
  const awaiting = state.players.find((p) => p.id === awaitingId);
  const bombActor = five.bombActorId
    ? state.players.find((p) => p.id === five.bombActorId)
    : undefined;
  const isAwaiting = !!you && you.id === awaitingId;
  const yourHand = five.yourHand ?? [];
  const hasZero = yourHand.some((c) => c.type === "number" && c.value === 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <GlassPanel className={`${FA_BOARD_PANEL_CLASS} p-2 sm:p-3`} style={FA_BOARD_PANEL_STYLE}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          Bomb response
        </p>
        <div className="mt-1 text-sm text-ink-steel">
          Running total reset to{" "}
          <span className="font-display font-extrabold">{five.runningTotal}</span>
        </div>
        <div className="mt-1 text-sm text-ink-steel">
          {bombActor ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8B1E1E]">
              Bomb by {bombActor.name}
            </p>
          ) : null}
          {isAwaiting
            ? hasZero
              ? "You have a 0 — auto-defusing…"
              : "No number 0 — you will lose 1 life…"
            : awaiting
              ? `${awaiting.name} is being checked for a 0…`
              : "Waiting for responders…"}
        </div>
        {five.bombResponderIds.length > 0 && (
          <p className="mt-1 font-mono text-[10px] text-ink-steel/80">
            {five.bombResponderIds
              .map((id) => state.players.find((p) => p.id === id)?.name ?? "?")
              .join(" → ")}
          </p>
        )}
        {paused && (
          <p className="mt-1 text-sm text-crimson">Paused — host must resume.</p>
        )}
        {actionsBlocked && (
          <p className="mt-1 text-sm text-[#8B1E1E]">Life lost — wait for the flip…</p>
        )}

        <div className="mt-2 sm:mt-3">
          <FiveAliveLifeTracker
            players={state.players}
            turnPlayerId={awaitingId}
            direction={five.direction}
            skipNext={five.skipNext}
            lifeAnim={lifeAnim}
            youId={you?.id ?? null}
            onInviteVoice={onInviteVoice}
            five={five}
          />
        </div>
      </GlassPanel>

      <GlassPanel
        className={`${FA_HAND_PANEL_CLASS} p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4`}
        style={FA_HAND_PANEL_STYLE}
      >
        <h3 className="font-sans text-lg font-bold uppercase tracking-wide text-[#7D2D2D] sm:text-xl">
          Your hand
        </h3>
        <p className="mt-1 text-sm text-[#7D2D2D]/70">
          Bomb resolves automatically — number 0 saves you, otherwise lose 1 life.
        </p>
        <div className="mt-2 pt-1 sm:mt-4">
          <FiveAliveHand cards={yourHand} disabled />
        </div>
      </GlassPanel>
    </div>
  );
}
