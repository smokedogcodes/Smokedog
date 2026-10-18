"use client";

import { PrimaryButton } from "@/components/ui/primitives";
import { BattleshipGrid } from "./BattleshipGrid";
import { shipsFromFleet } from "./BattleshipShipSprites";
import type { BattleshipPublicState } from "@/lib/games/battleship/selectors";
import type { PublicGameState } from "@/lib/types";
import { GRID_SIZE } from "@/lib/games/battleship/grid";
import type { PublicGridCell } from "@/lib/games/battleship/selectors";

function fleetRevealGrid(
  bs: BattleshipPublicState,
  which: "you" | "opp"
): PublicGridCell[][] {
  const base =
    which === "you"
      ? bs.yourGrid.map((row) => row.map((c) => ({ ...c })))
      : Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => ({
            ...bs.radarGrid[row]![col]!,
          }))
        );

  if (which === "opp" && bs.revealedOpponentFleet) {
    for (const ship of bs.revealedOpponentFleet) {
      const orientation =
        ship.cells.length > 1 && ship.cells[1]!.col === ship.cells[0]!.col
          ? ("vertical" as const)
          : ("horizontal" as const);
      ship.cells.forEach((c, i) => {
        base[c.row]![c.col] = {
          ...base[c.row]![c.col]!,
          ship: ship.type,
          hitOnShip: ship.hits[i],
          shipIndex: i,
          shipLength: ship.cells.length,
          shipOrientation: orientation,
        };
      });
    }
  }
  return base;
}

export function BattleshipGameOver({
  state,
  onRematch,
  onReturn,
  returning,
}: {
  state: PublicGameState;
  onRematch: () => void;
  onReturn: () => void;
  returning?: boolean;
}) {
  const bs = state.battleship;
  if (!bs || !state.you) return null;

  const winnerName =
    bs.winnerId && state.players.find((p) => p.id === bs.winnerId)?.name;
  const youWon = bs.winnerId === state.you.id;
  const stats = bs.stats;
  const accuracy =
    stats && stats.shotsFired > 0
      ? Math.round((stats.hits / stats.shotsFired) * 100)
      : 0;
  const powerUsed = stats
    ? (Object.values(stats.powerUpsUsed) as number[]).reduce(
        (a, b) => a + b,
        0
      )
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-sm border border-cyan-500/40 bg-slate-950/90 p-3 text-cyan-50 sm:p-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
          Debrief
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-cyan-100 sm:text-3xl">
          {youWon ? "Victory" : "Defeat"}
        </h2>
        <p className="mt-1 text-sm text-cyan-200/80">
          {winnerName ? `${winnerName} sinks the last ship.` : "Match over."}
        </p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Accuracy", `${accuracy}%`],
            ["Turns", String(stats.turnsTaken)],
            ["Hits", String(stats.hits)],
            ["Power-ups", String(powerUsed)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-sm border border-cyan-800/60 bg-slate-900/80 px-3 py-2"
            >
              <p className="font-mono text-[9px] uppercase tracking-wider text-cyan-500">
                {label}
              </p>
              <p className="font-display text-xl font-bold text-cyan-100">
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid justify-items-center gap-3 lg:grid-cols-2">
        <BattleshipGrid title="Your fleet" cells={fleetRevealGrid(bs, "you")} compact />
        <BattleshipGrid
          title="Enemy fleet (revealed)"
          cells={fleetRevealGrid(bs, "opp")}
          compact
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {state.you.isHost ? (
          <PrimaryButton
            type="button"
            onClick={onRematch}
            className="!bg-cyan-600 !text-slate-950"
          >
            Rematch
          </PrimaryButton>
        ) : (
          <p className="text-sm text-cyan-300/70">
            Waiting for host to rematch or return…
          </p>
        )}
        <PrimaryButton
          type="button"
          disabled={returning}
          onClick={onReturn}
          className="!bg-transparent !text-cyan-200 border border-cyan-700"
        >
          {returning ? "Returning…" : "Return to lobby"}
        </PrimaryButton>
      </div>
    </div>
  );
}
