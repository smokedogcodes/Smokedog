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
    <div className="flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-crimson/25 bg-manila/80 px-4 py-1 shadow-sm">
        <span
          className={`h-2 w-2 rounded-full ${
            yourTurn ? "bg-emerald-500 animate-ping" : "bg-ink-steel"
          }`}
        />
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink">
          {yourTurn ? "Your turn" : `${turnPlayer?.name ?? "Opponent"}'s turn`}
        </p>
      </div>

      <p className="mt-2 text-sm text-ink-steel">
        {yourTurn
          ? "Play any action cards or tap 'Draw Card & End Turn' below."
          : `Waiting for ${turnPlayer?.name ?? "opponent"} to act…`}
      </p>

      {ek.turnsRemaining > 1 && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-crimson/15 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-crimson">
          <span>⚡ ATTACK ACTIVE:</span>
          <span>{ek.turnsRemaining} turns remaining</span>
        </div>
      )}

      {state.logs.length > 0 && (
        <p className="mt-2 max-w-lg truncate rounded bg-manila/40 px-3 py-1 font-mono text-[11px] text-ink-steel border border-crimson/10">
          Last: {state.logs[state.logs.length - 1]?.text}
        </p>
      )}
    </div>
  );
}
