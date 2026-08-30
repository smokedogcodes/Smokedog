"use client";

import type { PublicGameState } from "@/lib/types";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";

export function EkOpponentSeats({
  state,
  ek,
}: {
  state: PublicGameState;
  ek: NonNullable<PublicGameState["explodingKittens"]>;
}) {
  const you = state.you;
  const opponents = state.players.filter(
    (p) => p.alive && p.id !== you?.id
  );

  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      {opponents.map((p) => {
        const count = ek.opponentHandCounts[p.id] ?? 0;
        const isTurn = ek.turnPlayerId === p.id;
        return (
          <div
            key={p.id}
            className={`flex flex-col items-center rounded-lg px-3 py-2 transition ${
              isTurn ? "bg-crimson/10 ring-2 ring-crimson/40" : ""
            }`}
          >
            <PlayerAvatar id={p.avatarId} size={56} />
            <p className="mt-1 max-w-[5rem] truncate text-xs font-semibold">
              {p.name}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-steel">
              {count} cards
            </p>
            {isTurn && ek.turnsRemaining > 1 ? (
              <p className="font-mono text-[9px] uppercase text-crimson">
                {ek.turnsRemaining} turns
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
