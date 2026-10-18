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
import { shipsFromFleet } from "./BattleshipShipSprites";
import type { PublicGridCell } from "@/lib/games/battleship/selectors";

function fleetToGrid(fleet: FleetPlacement): PublicGridCell[][] {
  const grid: PublicGridCell[][] = Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => ({ col, row }))
  );
  for (const ship of fleet) {
    const orientation =
      ship.cells.length > 1 && ship.cells[1]!.col === ship.cells[0]!.col
        ? ("vertical" as const)
        : ("horizontal" as const);
    ship.cells.forEach((c, i) => {
      grid[c.row]![c.col] = {
        ...grid[c.row]![c.col]!,
        ship: ship.type,
        shipIndex: i,
        shipLength: ship.cells.length,
        shipOrientation: orientation,
      };
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
      <div className="rounded-sm border border-cyan-500/30 bg-slate-950/70 p-4 text-center text-sm text-cyan-100">
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

  return (
    <div className="mx-auto max-w-md space-y-3 rounded-sm border border-cyan-500/30 bg-slate-950/80 p-3 text-cyan-50 sm:p-4">
      <div>
        <h3 className="font-display text-lg font-bold text-cyan-100 sm:text-xl">
          Deploy fleet
        </h3>
        <p className="mt-0.5 text-xs text-cyan-200/70 sm:text-sm">
          Select a ship, rotate, tap the grid. No overlaps.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FLEET_ROSTER.map((s) => {
          const placed = fleet.some((f) => f.type === s.type);
          return (
            <button
              key={s.type}
              type="button"
              disabled={placed}
              onClick={() => setSelected(s.type)}
              className={`rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-wider sm:px-2.5 sm:text-[10px] ${
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

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() =>
            setOrientation((o) =>
              o === "horizontal" ? "vertical" : "horizontal"
            )
          }
          className="rounded-sm border border-cyan-700 px-2.5 py-1 font-mono text-[9px] uppercase text-cyan-200 sm:text-[10px]"
        >
          Rotate: {orientation === "horizontal" ? "H" : "V"} ({previewLen})
        </button>
        <button
          type="button"
          onClick={() => setFleet(generateRandomFleetLayout())}
          className="rounded-sm border border-cyan-700 px-2.5 py-1 font-mono text-[9px] uppercase text-cyan-200 sm:text-[10px]"
        >
          Randomize
        </button>
        <button
          type="button"
          onClick={() => setFleet([])}
          className="rounded-sm border border-cyan-900 px-2.5 py-1 font-mono text-[9px] uppercase text-cyan-400/70 sm:text-[10px]"
        >
          Clear
        </button>
      </div>

      <BattleshipGrid
        title="Friendly waters"
        cells={fleetToGrid(fleet)}
        ships={shipsFromFleet(fleet)}
        interactive
        onCellClick={onCell}
      />

      <PrimaryButton
        type="button"
        disabled={!isCompleteFleet(fleet)}
        onClick={() => onReady(fleet)}
        className="w-full !bg-cyan-600 !py-2.5 !text-slate-950"
      >
        Lock in fleet
      </PrimaryButton>
    </div>
  );
}
