import { computeApGain } from "./ap";
import {
  coordKey,
  GRID_SIZE,
  inBounds,
  type Coord,
} from "./grid";
import {
  remainingCells,
  shipAt,
  type FleetPlacement,
} from "./placement";
import type {
  Orientation,
  PowerUpType,
  TorpedoDirection,
} from "./powerups";
import { powerUpCost } from "./powerups";
import type { ShipType } from "./ships";
import { shipLabel } from "./ships";

export type CellMark = "hit" | "miss" | "obscured" | "revealed_empty" | "revealed_ship";

export type ShotMap = Record<string, CellMark>;

export type SmokeZone = {
  ownerId: string; // defender who deployed smoke on their grid
  cells: Coord[];
  turnsRemaining: number; // attacker turns until expire
};

export type StrikeResult = {
  cells: { col: number; row: number; mark: CellMark; sunkShip?: ShipType }[];
  apGain: number;
  logs: string[];
  winnerId: string | null;
  sonarPing?: boolean;
  reconCells?: { col: number; row: number; hasShip: boolean }[];
};

function markKey(col: number, row: number) {
  return coordKey(col, row);
}

export function isAlreadyTargeted(shots: ShotMap, col: number, row: number): boolean {
  const m = shots[markKey(col, row)];
  return m === "hit" || m === "miss" || m === "obscured";
}

function inSmoke(smoke: SmokeZone[], col: number, row: number, defenderId: string): boolean {
  return smoke.some(
    (z) =>
      z.ownerId === defenderId &&
      z.turnsRemaining > 0 &&
      z.cells.some((c) => c.col === col && c.row === row)
  );
}

function applyHitToFleet(
  fleet: FleetPlacement,
  col: number,
  row: number
): { fleet: FleetPlacement; hit: boolean; sunk: ShipType | null } {
  const found = shipAt(fleet, col, row);
  if (!found) return { fleet, hit: false, sunk: null };
  const { ship, idx } = found;
  if (ship.hits[idx]) return { fleet, hit: true, sunk: ship.sunk ? ship.type : null };
  const nextHits = [...ship.hits];
  nextHits[idx] = true;
  const sunk = nextHits.every(Boolean);
  const nextShip = { ...ship, hits: nextHits, sunk };
  const nextFleet = fleet.map((s) => (s.type === ship.type ? nextShip : s));
  return { fleet: nextFleet, hit: true, sunk: sunk ? ship.type : null };
}

export function applyStrikeCells(
  defenderFleet: FleetPlacement,
  attackerShots: ShotMap,
  cells: Coord[],
  smoke: SmokeZone[],
  defenderId: string,
  attackerName: string
): {
  fleet: FleetPlacement;
  shots: ShotMap;
  result: StrikeResult;
} {
  let fleet = defenderFleet;
  const shots = { ...attackerShots };
  let hits = 0;
  let misses = 0;
  let sunkCount = 0;
  const cellResults: StrikeResult["cells"] = [];
  const logs: string[] = [];

  for (const { col, row } of cells) {
    if (!inBounds(col, row)) continue;
    if (isAlreadyTargeted(shots, col, row)) continue;

    const smoked = inSmoke(smoke, col, row, defenderId);
    const applied = applyHitToFleet(fleet, col, row);
    fleet = applied.fleet;

    if (applied.hit) {
      hits++;
      if (smoked) {
        shots[markKey(col, row)] = "obscured";
        cellResults.push({ col, row, mark: "obscured" });
      } else {
        shots[markKey(col, row)] = "hit";
        cellResults.push({
          col,
          row,
          mark: "hit",
          sunkShip: applied.sunk ?? undefined,
        });
        if (applied.sunk) {
          sunkCount++;
          logs.push(`${attackerName} sunk the ${shipLabel(applied.sunk)}!`);
        }
      }
    } else {
      misses++;
      if (smoked) {
        shots[markKey(col, row)] = "obscured";
        cellResults.push({ col, row, mark: "obscured" });
      } else {
        shots[markKey(col, row)] = "miss";
        cellResults.push({ col, row, mark: "miss" });
      }
    }
  }

  const apGain = computeApGain({ hits, misses, sunk: sunkCount });
  const winnerId = remainingCells(fleet) === 0 ? "attacker" : null;

  return {
    fleet,
    shots,
    result: { cells: cellResults, apGain, logs, winnerId },
  };
}

export function clusterCells(center: Coord): Coord[] {
  return [
    center,
    { col: center.col, row: center.row - 1 },
    { col: center.col, row: center.row + 1 },
    { col: center.col - 1, row: center.row },
    { col: center.col + 1, row: center.row },
  ].filter((c) => inBounds(c.col, c.row));
}

export function sonarCells(center: Coord): Coord[] {
  const out: Coord[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const col = center.col + dc;
      const row = center.row + dr;
      if (inBounds(col, row)) out.push({ col, row });
    }
  }
  return out;
}

export function smokeCells(center: Coord): Coord[] {
  return sonarCells(center);
}

export function torpedoCells(
  start: Coord,
  direction: TorpedoDirection,
  defenderFleet: FleetPlacement,
  attackerShots: ShotMap
): Coord[] {
  const delta =
    direction === "N"
      ? { col: 0, row: -1 }
      : direction === "S"
        ? { col: 0, row: 1 }
        : direction === "W"
          ? { col: -1, row: 0 }
          : { col: 1, row: 0 };

  const path: Coord[] = [];
  let col = start.col;
  let row = start.row;
  while (inBounds(col, row)) {
    if (!isAlreadyTargeted(attackerShots, col, row)) {
      path.push({ col, row });
      const hit = shipAt(defenderFleet, col, row);
      if (hit) break;
    } else {
      // skip already targeted but continue? Spec: fire until first ship segment.
      // If already targeted empty, continue; if already hit ship, stop without restriking.
      const hit = shipAt(defenderFleet, col, row);
      if (hit) break;
    }
    col += delta.col;
    row += delta.row;
  }
  return path;
}

export function reconLine(
  index: number,
  orientation: Orientation
): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (orientation === "horizontal") {
      cells.push({ col: i, row: index });
    } else {
      cells.push({ col: index, row: i });
    }
  }
  return cells;
}

export function sonarDetectsShip(
  fleet: FleetPlacement,
  center: Coord,
  smoke: SmokeZone[],
  defenderId: string
): boolean {
  for (const c of sonarCells(center)) {
    if (inSmoke(smoke, c.col, c.row, defenderId)) continue;
    if (shipAt(fleet, c.col, c.row)) return true;
  }
  return false;
}

export function tickSmokeZones(smoke: SmokeZone[]): SmokeZone[] {
  return smoke
    .map((z) => ({ ...z, turnsRemaining: z.turnsRemaining - 1 }))
    .filter((z) => z.turnsRemaining > 0);
}

export function revealObscuredInExpiredSmoke(
  shots: ShotMap,
  fleet: FleetPlacement,
  expiredCells: Coord[]
): ShotMap {
  const next = { ...shots };
  for (const c of expiredCells) {
    const k = markKey(c.col, c.row);
    if (next[k] !== "obscured") continue;
    next[k] = shipAt(fleet, c.col, c.row) ? "hit" : "miss";
  }
  return next;
}

export { powerUpCost };
export type { PowerUpType, Orientation, TorpedoDirection };
