"use client";

import type { ExplodingKittensPublicState, PublicGameState } from "@/lib/types";

export function EkStatusHud({
  state,
  ek,
}: {
  state: PublicGameState;
  ek: ExplodingKittensPublicState;
}) {
  const you = state.you;
  const yourTurn = ek.turnPlayerId === you?.id;
  const turnPlayer = state.players.find((p) => p.id === ek.turnPlayerId);

  return (
    <div className="text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
        {yourTurn ? "Your turn" : `${turnPlayer?.name ?? "Player"}'s turn`}
      </p>
      <p className="mt-1 text-sm text-ink-steel">
        {ek.subPhase === "play"
          ? "Play cards or end turn to draw."
          : "Click the draw pile to end your turn."}
      </p>
      {ek.turnsRemaining > 1 && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-crimson/80">
          Attack — {ek.turnsRemaining} turns remaining
        </p>
      )}
      {state.logs.length > 0 && (
        <p className="mt-2 truncate text-xs text-ink-steel/80">
          {state.logs[state.logs.length - 1]?.text}
        </p>
      )}
    </div>
  );
}
