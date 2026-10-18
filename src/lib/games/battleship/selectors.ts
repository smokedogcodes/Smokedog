import { COL_LABELS, coordKey, GRID_SIZE } from "./grid";
import type { CellMark } from "./logic";
import { remainingCells, type FleetPlacement } from "./placement";
import {
  POWERUP_BLURBS,
  POWERUP_COSTS,
  POWERUP_LABELS,
  type PowerUpType,
} from "./powerups";
import type { BattleshipGameState } from "./state";
import { opponentId } from "./state";
import type { ShipType } from "./ships";

export type PublicGridCell = {
  col: number;
  row: number;
  /** Own fleet: ship segment / hit on self */
  ship?: ShipType | null;
  hitOnShip?: boolean;
  /** Segment metadata so UI can draw continuous hull art */
  shipIndex?: number;
  shipLength?: number;
  shipOrientation?: "horizontal" | "vertical";
  /** Incoming / outgoing marks */
  mark?: CellMark | null;
  smoke?: boolean;
};

export type PublicShipStatus = {
  type: ShipType;
  length: number;
  sunk: boolean;
  hits: number;
};

export type BattleshipPublicState = {
  phase: "setup" | "battle" | "gameover";
  yourId: string | null;
  opponentId: string | null;
  turnPlayerId: string | null;
  yourReady: boolean;
  opponentReady: boolean;
  yourAp: number;
  opponentAp: number;
  /** Friendly grid (ships visible) */
  yourGrid: PublicGridCell[][];
  /** Radar targeting opponent */
  radarGrid: PublicGridCell[][];
  yourShips: PublicShipStatus[];
  opponentShips: PublicShipStatus[];
  yourRemainingCells: number;
  opponentRemainingCells: number;
  winnerId: string | null;
  lastActionLog: string[];
  powerUps: {
    type: PowerUpType;
    label: string;
    cost: number;
    blurb: string;
    affordable: boolean;
  }[];
  privateIntel: BattleshipGameState["privateIntel"][string];
  stats: BattleshipGameState["stats"][string] | null;
  opponentStats: BattleshipGameState["stats"][string] | null;
  /** Full opponent fleet — only on gameover */
  revealedOpponentFleet: FleetPlacement | null;
  colLabels: readonly string[];
  gridSize: number;
};

function emptyGrid(): PublicGridCell[][] {
  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => ({ col, row }))
  );
}

export function projectBattleshipPublic(
  state: BattleshipGameState,
  viewerId: string | null
): BattleshipPublicState {
  const you = viewerId && state.playerIds.includes(viewerId) ? viewerId : null;
  const opp = you ? opponentId(state, you) : null;
  const revealAll = state.phase === "gameover";

  const yourFleet = you ? state.fleets[you] ?? [] : [];
  const oppFleet = opp ? state.fleets[opp] ?? [] : [];
  const yourShots = you ? state.shotsByAttacker[you] ?? {} : {};
  const shotsOnYou = opp ? state.shotsByAttacker[opp] ?? {} : {};

  const yourGrid = emptyGrid();
  const radarGrid = emptyGrid();

  const smokeKeys = new Set(
    state.smokeZones
      .filter((z) => z.ownerId === you && z.turnsRemaining > 0)
      .flatMap((z) => z.cells.map((c) => coordKey(c.col, c.row)))
  );
  const oppSmokeKeys = new Set(
    state.smokeZones
      .filter((z) => z.ownerId === opp && z.turnsRemaining > 0)
      .flatMap((z) => z.cells.map((c) => coordKey(c.col, c.row)))
  );

  if (you) {
    for (const ship of yourFleet) {
      const orientation =
        ship.cells.length > 1 && ship.cells[1]!.col === ship.cells[0]!.col
          ? ("vertical" as const)
          : ("horizontal" as const);
      ship.cells.forEach((c, i) => {
        yourGrid[c.row]![c.col] = {
          ...yourGrid[c.row]![c.col]!,
          ship: ship.type,
          hitOnShip: ship.hits[i],
          shipIndex: i,
          shipLength: ship.cells.length,
          shipOrientation: orientation,
        };
      });
    }
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const k = coordKey(col, row);
        const incoming = shotsOnYou[k];
        if (incoming === "hit" || incoming === "miss" || incoming === "obscured") {
          // Defender always sees truth for hits on self
          const truth = yourFleet.some(
            (s) =>
              s.cells.some((c, i) => c.col === col && c.row === row && s.hits[i])
          )
            ? "hit"
            : incoming === "obscured"
              ? yourFleet.some((s) =>
                  s.cells.some((c) => c.col === col && c.row === row)
                )
                ? "hit"
                : "miss"
              : incoming;
          yourGrid[row]![col] = {
            ...yourGrid[row]![col]!,
            mark: truth as CellMark,
            smoke: smokeKeys.has(k),
          };
        } else if (smokeKeys.has(k)) {
          yourGrid[row]![col] = { ...yourGrid[row]![col]!, smoke: true };
        }
      }
    }
  }

  if (you && opp) {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const k = coordKey(col, row);
        let mark = yourShots[k] ?? null;
        if (revealAll) {
          const has = oppFleet.some((s) =>
            s.cells.some((c) => c.col === col && c.row === row)
          );
          const hit = oppFleet.some((s) =>
            s.cells.some((c, i) => c.col === col && c.row === row && s.hits[i])
          );
          if (hit) mark = "hit";
          else if (mark === "miss" || mark === "obscured") mark = mark === "obscured" ? (has ? "hit" : "miss") : mark;
          const ship = oppFleet.find((s) =>
            s.cells.some((c) => c.col === col && c.row === row)
          );
          const seg = ship
            ? ship.cells.findIndex((c) => c.col === col && c.row === row)
            : -1;
          const orientation =
            ship &&
            ship.cells.length > 1 &&
            ship.cells[1]!.col === ship.cells[0]!.col
              ? ("vertical" as const)
              : ("horizontal" as const);
          radarGrid[row]![col] = {
            col,
            row,
            mark,
            ship: ship?.type ?? null,
            hitOnShip: hit,
            shipIndex: seg >= 0 ? seg : undefined,
            shipLength: ship?.cells.length,
            shipOrientation: ship ? orientation : undefined,
            smoke: oppSmokeKeys.has(k),
          };
        } else {
          const sunkShip = oppFleet.find(
            (s) => s.sunk && s.cells.some((c) => c.col === col && c.row === row)
          );
          if (sunkShip) {
            const seg = sunkShip.cells.findIndex((c) => c.col === col && c.row === row);
            const orientation =
              sunkShip.cells.length > 1 && sunkShip.cells[1]!.col === sunkShip.cells[0]!.col
                ? ("vertical" as const)
                : ("horizontal" as const);
            radarGrid[row]![col] = {
              col,
              row,
              mark,
              ship: sunkShip.type,
              hitOnShip: true,
              shipIndex: seg >= 0 ? seg : undefined,
              shipLength: sunkShip.cells.length,
              shipOrientation: orientation,
              smoke: oppSmokeKeys.has(k),
            };
          } else {
            radarGrid[row]![col] = {
              col,
              row,
              mark,
              smoke: oppSmokeKeys.has(k),
            };
          }
        }
      }
    }
  }

  const yourShips = yourFleet.map((s) => ({
    type: s.type,
    length: s.cells.length,
    sunk: s.sunk,
    hits: s.hits.filter(Boolean).length,
  }));

  const opponentShips = oppFleet.map((s) => ({
    type: s.type,
    length: s.cells.length,
    sunk: s.sunk,
    hits: revealAll || s.sunk ? s.hits.filter(Boolean).length : 0,
  }));

  const ap = you ? state.ap[you] ?? 0 : 0;

  return {
    phase: state.phase,
    yourId: you,
    opponentId: opp,
    turnPlayerId: state.turnPlayerId,
    yourReady: you ? !!state.ready[you] : false,
    opponentReady: opp ? !!state.ready[opp] : false,
    yourAp: ap,
    opponentAp: opp ? state.ap[opp] ?? 0 : 0,
    yourGrid,
    radarGrid,
    yourShips,
    opponentShips,
    yourRemainingCells: remainingCells(yourFleet),
    opponentRemainingCells: remainingCells(oppFleet),
    winnerId: state.winnerId,
    lastActionLog: state.lastActionLog,
    powerUps: (Object.keys(POWERUP_COSTS) as PowerUpType[]).map((type) => ({
      type,
      label: POWERUP_LABELS[type],
      cost: POWERUP_COSTS[type],
      blurb: POWERUP_BLURBS[type],
      affordable: ap >= POWERUP_COSTS[type],
    })),
    privateIntel: you ? state.privateIntel[you] ?? null : null,
    stats: you ? state.stats[you] ?? null : null,
    opponentStats: revealAll && opp ? state.stats[opp] ?? null : null,
    revealedOpponentFleet: revealAll && opp ? oppFleet : null,
    colLabels: COL_LABELS,
    gridSize: GRID_SIZE,
  };
}
