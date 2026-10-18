"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canPlaceShip,
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
  const [hoverCoord, setHoverCoord] = useState<{ col: number; row: number } | null>(null);

  // Keyboard shortcut: 'R' to rotate ship
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key.toLowerCase() === "r") {
        setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const placementPreview = useMemo(() => {
    if (!hoverCoord || !selected) return null;
    const isAlreadyPlaced = fleet.some((f) => f.type === selected);
    const effectiveFleet = isAlreadyPlaced
      ? fleet.filter((f) => f.type !== selected)
      : fleet;
    const valid = canPlaceShip(effectiveFleet, selected, hoverCoord, orientation);
    const def = FLEET_ROSTER.find((s) => s.type === selected);
    const len = def?.length ?? 0;
    const cells: { col: number; row: number }[] = [];
    for (let i = 0; i < len; i++) {
      const c = orientation === "horizontal" ? hoverCoord.col + i : hoverCoord.col;
      const r = orientation === "vertical" ? hoverCoord.row + i : hoverCoord.row;
      if (c < GRID_SIZE && r < GRID_SIZE) {
        cells.push({ col: c, row: r });
      }
    }
    return { cells, valid };
  }, [hoverCoord, selected, orientation, fleet]);

  if (alreadyReady) {
    return (
      <div className="rounded-sm border border-cyan-500/30 bg-slate-950/70 p-6 text-center text-cyan-100 space-y-2">
        <div className="text-2xl animate-spin">⚓</div>
        <p className="font-display text-lg font-bold">Fleet Locked In</p>
        <p className="text-xs text-cyan-200/70">
          Waiting for opponent to finish deployment…
        </p>
      </div>
    );
  }

  const selectedDef = FLEET_ROSTER.find((s) => s.type === selected);
  const previewLen = selectedDef?.length ?? 0;
  const complete = isCompleteFleet(fleet);

  const onCell = (col: number, row: number) => {
    // If user clicked on a placed ship and hasn't selected an unplaced one, allow picking it up
    const clickedShip = fleet.find((s) =>
      s.cells.some((c) => c.col === col && c.row === row)
    );
    const isCurrentPlaced = fleet.some((f) => f.type === selected);

    if (clickedShip && isCurrentPlaced && clickedShip.type !== selected) {
      setSelected(clickedShip.type);
      setFleet((prev) => prev.filter((s) => s.type !== clickedShip.type));
      return;
    }

    const effectiveFleet = isCurrentPlaced
      ? fleet.filter((f) => f.type !== selected)
      : fleet;
    const next = placeShip(effectiveFleet, selected, { col, row }, orientation);
    if (!next) return;
    setFleet(next);

    // Auto-advance to next unplaced ship
    const remaining = FLEET_ROSTER.find(
      (d) => !next.some((s) => s.type === d.type)
    );
    if (remaining) {
      setSelected(remaining.type);
    }
  };

  const handleSelectShip = (type: ShipType) => {
    setSelected(type);
    // If clicking an already placed ship, pick it up for repositioning
    if (fleet.some((f) => f.type === type)) {
      setFleet((prev) => prev.filter((s) => s.type !== type));
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-3 rounded-sm border border-cyan-500/30 bg-slate-950/80 p-3 text-cyan-50 sm:p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-cyan-100 sm:text-xl">
            Deploy Fleet
          </h3>
          <p className="text-xs text-cyan-200/70">
            {complete
              ? "All 5 ships deployed! Lock in when ready."
              : `Placed ${fleet.length} of 5 ships. Tap grid to position.`}
          </p>
        </div>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase font-bold tracking-wider ${
            complete
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-cyan-950 text-cyan-400 border border-cyan-800"
          }`}
        >
          {fleet.length}/5 Placed
        </span>
      </div>

      {/* Ship Selection Roster */}
      <div className="space-y-1">
        <p className="font-mono text-[9px] uppercase tracking-wider text-cyan-400/80">
          Select Ship (Tap placed ship to relocate):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FLEET_ROSTER.map((s) => {
            const placed = fleet.some((f) => f.type === s.type);
            const isSel = selected === s.type;
            return (
              <button
                key={s.type}
                type="button"
                onClick={() => handleSelectShip(s.type)}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-wider sm:px-2.5 sm:text-[10px] transition ${
                  isSel
                    ? "border-amber-400 bg-amber-500/20 text-amber-100 ring-1 ring-amber-400"
                    : placed
                      ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-300 hover:border-emerald-400"
                      : "border-cyan-800 bg-slate-900/60 text-cyan-300 hover:border-cyan-400"
                }`}
              >
                <span>{s.label}</span>
                <span className="opacity-60 text-[8px]">({s.length})</span>
                {placed && <span className="text-emerald-400 font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Placement Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            setOrientation((o) =>
              o === "horizontal" ? "vertical" : "horizontal"
            )
          }
          className="flex items-center gap-1 rounded-sm border border-cyan-600 bg-cyan-950/60 px-3 py-1 font-mono text-[10px] uppercase font-bold text-cyan-100 hover:bg-cyan-900/40 transition"
        >
          <span>Rotate [R]:</span>
          <span className="text-amber-300">
            {orientation === "horizontal" ? "Horizontal ↔" : "Vertical ↕"}
          </span>
          <span className="opacity-70 text-[9px]">({previewLen})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const randomized = generateRandomFleetLayout();
            setFleet(randomized);
          }}
          className="rounded-sm border border-cyan-700 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] uppercase text-cyan-200 hover:bg-cyan-900/50 hover:text-cyan-100 transition"
        >
          🎲 Randomize
        </button>

        <button
          type="button"
          onClick={() => setFleet([])}
          className="rounded-sm border border-cyan-900 px-2.5 py-1 font-mono text-[10px] uppercase text-cyan-400/70 hover:bg-red-950/30 hover:border-red-800 hover:text-red-300 transition"
        >
          Reset
        </button>
      </div>

      <BattleshipGrid
        title="Friendly Waters — Fleet Formation"
        cells={fleetToGrid(fleet)}
        ships={shipsFromFleet(fleet)}
        interactive
        onCellClick={onCell}
        onCellHover={(col, row) => setHoverCoord({ col, row })}
        onCellLeave={() => setHoverCoord(null)}
        placementPreview={placementPreview}
      />

      <PrimaryButton
        type="button"
        disabled={!complete}
        onClick={() => onReady(fleet)}
        className="w-full !bg-cyan-500 hover:!bg-cyan-400 !py-2.5 !text-slate-950 font-bold uppercase tracking-wider shadow-lg transition active:scale-95 disabled:opacity-40"
      >
        {complete ? "⚓ Lock In Fleet (Ready!)" : `Place all 5 ships (${fleet.length}/5)`}
      </PrimaryButton>
    </div>
  );
}
