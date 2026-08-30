import { coordKey, GRID_SIZE, inBounds, type Coord } from "./grid";
import type { Orientation } from "./powerups";
import {
  FLEET_ROSTER,
  shipLength,
  type ShipType,
} from "./ships";

export type PlacedShip = {
  type: ShipType;
  cells: Coord[];
  hits: boolean[];
  sunk: boolean;
};

export type FleetPlacement = PlacedShip[];

function cellsForShip(
  type: ShipType,
  origin: Coord,
  orientation: Orientation
): Coord[] | null {
  const len = shipLength(type);
  const cells: Coord[] = [];
  for (let i = 0; i < len; i++) {
    const col = orientation === "horizontal" ? origin.col + i : origin.col;
    const row = orientation === "vertical" ? origin.row + i : origin.row;
    if (!inBounds(col, row)) return null;
    cells.push({ col, row });
  }
  return cells;
}

export function canPlaceShip(
  fleet: FleetPlacement,
  type: ShipType,
  origin: Coord,
  orientation: Orientation
): boolean {
  if (fleet.some((s) => s.type === type)) return false;
  const cells = cellsForShip(type, origin, orientation);
  if (!cells) return false;
  const occupied = new Set(
    fleet.flatMap((s) => s.cells.map((c) => coordKey(c.col, c.row)))
  );
  return cells.every((c) => !occupied.has(coordKey(c.col, c.row)));
}

export function placeShip(
  fleet: FleetPlacement,
  type: ShipType,
  origin: Coord,
  orientation: Orientation
): FleetPlacement | null {
  if (!canPlaceShip(fleet, type, origin, orientation)) return null;
  const cells = cellsForShip(type, origin, orientation)!;
  return [
    ...fleet.filter((s) => s.type !== type),
    {
      type,
      cells,
      hits: cells.map(() => false),
      sunk: false,
    },
  ];
}

export function isCompleteFleet(fleet: FleetPlacement): boolean {
  if (fleet.length !== FLEET_ROSTER.length) return false;
  const types = new Set(fleet.map((s) => s.type));
  return FLEET_ROSTER.every((d) => types.has(d.type));
}

export function validateFleet(fleet: FleetPlacement): boolean {
  if (!isCompleteFleet(fleet)) return false;
  const seen = new Set<string>();
  for (const ship of fleet) {
    const expected = shipLength(ship.type);
    if (ship.cells.length !== expected) return false;
    if (ship.hits.length !== expected) return false;
    for (const c of ship.cells) {
      if (!inBounds(c.col, c.row)) return false;
      const k = coordKey(c.col, c.row);
      if (seen.has(k)) return false;
      seen.add(k);
    }
  }
  return true;
}

export function generateRandomFleetLayout(
  rng: () => number = Math.random
): FleetPlacement {
  for (let overall = 0; overall < 50; overall++) {
    let fleet: FleetPlacement = [];
    const order = [...FLEET_ROSTER].sort(() => rng() - 0.5);
    let ok = true;
    for (const def of order) {
      let placed = false;
      const tries: { col: number; row: number; orientation: Orientation }[] =
        [];
      for (let col = 0; col < GRID_SIZE; col++) {
        for (let row = 0; row < GRID_SIZE; row++) {
          tries.push({ col, row, orientation: "horizontal" });
          tries.push({ col, row, orientation: "vertical" });
        }
      }
      // shuffle tries
      for (let i = tries.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [tries[i], tries[j]] = [tries[j]!, tries[i]!];
      }
      for (const t of tries) {
        const next = placeShip(fleet, def.type, { col: t.col, row: t.row }, t.orientation);
        if (next) {
          fleet = next;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok && isCompleteFleet(fleet)) return fleet;
  }
  throw new Error("Could not generate a valid fleet layout");
}

export function remainingCells(fleet: FleetPlacement): number {
  let n = 0;
  for (const ship of fleet) {
    for (let i = 0; i < ship.cells.length; i++) {
      if (!ship.hits[i]) n++;
    }
  }
  return n;
}

export function shipAt(fleet: FleetPlacement, col: number, row: number) {
  for (const ship of fleet) {
    const idx = ship.cells.findIndex((c) => c.col === col && c.row === row);
    if (idx >= 0) return { ship, idx };
  }
  return null;
}
