"use client";

import { useState } from "react";
import {
  generateRandomFleetLayout,
  isCompleteFleet,
  placeShip,
  type FleetPlacement,
} from "@/lib/games/battleship/placement";
import { FLEET_ROSTER, type ShipType } from "@/lib/games/battleship/ships";
import type { Orientation } from "@/lib/games/battleship/powerups";
import { GRID_SIZE } from "@/lib/games/battleship/grid";
import { PrimaryButton } from "@/components/ui/primitives";
import { BattleshipGrid } from "./BattleshipGrid";
import type { PublicGridCell } from "@/lib/games/battleship/selectors";

function fleetToGrid(fleet: FleetPlacement): PublicGridCell[][] {
  const grid: PublicGridCell[][] = Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => ({ col, row }))
  );
  for (const ship of fleet) {
    ship.cells.forEach((c) => {
      grid[c.row]![c.col] = { ...grid[c.row]![c.col]!, ship: ship.type };
    });
  }
  return grid;
}

export function BattleshipPlacement({
  onReady,
  alreadyReady,
}: {
  onReady: (fleet: FleetPlacement) => void;
  alreadyReady: boolean;
}) {
  const [fleet, setFleet] = useState<FleetPlacement>([]);
  const [selected, setSelected] = useState<ShipType>("carrier");
  const [orientation, setOrientation] = useState<Orientation>("horizontal");

  if (alreadyReady) {
    return (
      <div className="rounded-sm border border-cyan-500/30 bg-slate-950/70 p-6 text-center text-cyan-100">
        Fleet locked in. Waiting for opponent…
      </div>
    );
  }

  const previewLen =
    FLEET_ROSTER.find((s) => s.type === selected)?.length ?? 0;

  const onCell = (col: number, row: number) => {
    const next = placeShip(fleet, selected, { col, row }, orientation);
    if (!next) return;
    setFleet(next);
    const remaining = FLEET_ROSTER.find(
      (d) => !next.some((s) => s.type === d.type)
    );
    if (remaining) setSelected(remaining.type);
  };

  const preview: { col: number; row: number }[] = [];
  // no hover preview state for simplicity — rotation + place

  return (
    <div className="space-y-4 rounded-sm border border-cyan-500/30 bg-slate-950/80 p-4 text-cyan-50">
      <div>
        <h3 className="font-display text-xl font-bold text-cyan-100">
          Deploy fleet
        </h3>
        <p className="mt-1 text-sm text-cyan-200/70">
          Select a ship, set orientation, tap the grid. No overlaps.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FLEET_ROSTER.map((s) => {
          const placed = fleet.some((f) => f.type === s.type);
          return (
            <button
              key={s.type}
              type="button"
              disabled={placed}
              onClick={() => setSelected(s.type)}
              className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                selected === s.type && !placed
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                  : placed
                    ? "border-slate-700 text-slate-500"
                    : "border-cyan-800 text-cyan-300"
              }`}
            >
              {s.label} ({s.length})
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setOrientation((o) =>
              o === "horizontal" ? "vertical" : "horizontal"
            )
          }
          className="rounded-sm border border-cyan-700 px-3 py-1.5 font-mono text-[10px] uppercase text-cyan-200"
        >
          Rotate: {orientation} ({previewLen})
        </button>
        <button
          type="button"
          onClick={() => setFleet(generateRandomFleetLayout())}
          className="rounded-sm border border-cyan-700 px-3 py-1.5 font-mono text-[10px] uppercase text-cyan-200"
        >
          Randomize
        </button>
        <button
          type="button"
          onClick={() => setFleet([])}
          className="rounded-sm border border-cyan-900 px-3 py-1.5 font-mono text-[10px] uppercase text-cyan-400/70"
        >
          Clear
        </button>
      </div>

      <BattleshipGrid
        title="Friendly waters"
        cells={fleetToGrid(fleet)}
        interactive
        onCellClick={onCell}
        preview={preview}
      />

      <PrimaryButton
        type="button"
        disabled={!isCompleteFleet(fleet)}
        onClick={() => onReady(fleet)}
        className="w-full !bg-cyan-600 !text-slate-950"
      >
        Lock in fleet
      </PrimaryButton>
    </div>
  );
}
