import { computeApGain } from "./ap";
import {
  applyStrikeCells,
  clusterCells,
  isAlreadyTargeted,
  reconLine,
  revealObscuredInExpiredSmoke,
  smokeCells,
  sonarCells,
  sonarDetectsShip,
  tickSmokeZones,
  torpedoCells,
  type CellMark,
} from "./logic";
import {
  generateRandomFleetLayout,
  isCompleteFleet,
  remainingCells,
  shipAt,
  validateFleet,
  type FleetPlacement,
} from "./placement";
import {
  powerUpCost,
  type Orientation,
  type PowerUpType,
  type TorpedoDirection,
} from "./powerups";
import {
  createBattleshipState,
  opponentId,
  type BattleshipGameState,
} from "./state";
import { coordKey } from "./grid";

export function beginBattleship(playerIds: [string, string]): BattleshipGameState {
  return createBattleshipState(playerIds);
}

export function submitFleetReady(
  state: BattleshipGameState,
  playerId: string,
  fleet: FleetPlacement,
  startPlayerId?: string
): BattleshipGameState {
  if (state.phase !== "setup") return state;
  if (!state.playerIds.includes(playerId)) return state;
  if (!validateFleet(fleet)) return state;

  const next: BattleshipGameState = {
    ...state,
    fleets: { ...state.fleets, [playerId]: fleet.map((s) => ({ ...s, cells: [...s.cells], hits: [...s.hits] })) },
    ready: { ...state.ready, [playerId]: true },
  };

  const bothReady = next.playerIds.every((id) => next.ready[id]);
  if (!bothReady) return next;

  const starter =
    startPlayerId && next.playerIds.includes(startPlayerId)
      ? startPlayerId
      : next.playerIds[Math.floor(Math.random() * 2)]!;

  return {
    ...next,
    phase: "battle",
    turnPlayerId: starter,
    lastActionLog: ["Battle stations! Fire when ready."],
  };
}

export function autoReadyRandomFleet(
  state: BattleshipGameState,
  playerId: string,
  rng: () => number = Math.random
): BattleshipGameState {
  if (state.ready[playerId]) return state;
  return submitFleetReady(state, playerId, generateRandomFleetLayout(rng));
}

function endTurn(state: BattleshipGameState, attackerId: string): BattleshipGameState {
  const defenderId = opponentId(state, attackerId);
  const expired = state.smokeZones.filter((z) => z.turnsRemaining <= 1);
  const expiredCells = expired.flatMap((z) => z.cells);
  let shotsByAttacker = { ...state.shotsByAttacker };

  // When smoke expires, reveal obscured shots on that defender's grid (both attackers' maps that target defender)
  for (const aid of state.playerIds) {
    if (aid === defenderId) continue;
    // attacker maps are keyed by attacker; shots are on opponent grid
  }
  // Smoke is on defender's friendly grid; attackers' shot maps toward that defender
  const attackerOnDefender = Object.keys(shotsByAttacker).filter(
    (id) => id !== defenderId
  );
  for (const aid of attackerOnDefender) {
    const fleet = state.fleets[defenderId] ?? [];
    shotsByAttacker[aid] = revealObscuredInExpiredSmoke(
      shotsByAttacker[aid] ?? {},
      fleet,
      expiredCells.filter((c) =>
        expired.some(
          (z) =>
            z.ownerId === defenderId &&
            z.cells.some((x) => x.col === c.col && x.row === c.row)
        )
      )
    );
  }

  const smokeZones = tickSmokeZones(state.smokeZones);
  const stats = {
    ...state.stats,
    [attackerId]: {
      ...state.stats[attackerId]!,
      turnsTaken: (state.stats[attackerId]?.turnsTaken ?? 0) + 1,
    },
  };

  return {
    ...state,
    smokeZones,
    shotsByAttacker,
    stats,
    turnPlayerId: defenderId,
  };
}

export function fireStandardShot(
  state: BattleshipGameState,
  attackerId: string,
  col: number,
  row: number
): BattleshipGameState {
  if (state.phase !== "battle" || state.turnPlayerId !== attackerId) return state;
  const defenderId = opponentId(state, attackerId);
  const shots = state.shotsByAttacker[attackerId] ?? {};
  if (isAlreadyTargeted(shots, col, row)) return state;

  const applied = applyStrikeCells(
    state.fleets[defenderId] ?? [],
    shots,
    [{ col, row }],
    state.smokeZones,
    defenderId,
    "Strike"
  );

  const stats = { ...state.stats };
  const st = { ...stats[attackerId]! };
  st.shotsFired += applied.result.cells.length;
  for (const c of applied.result.cells) {
    if (c.mark === "hit") st.hits++;
    if (c.mark === "miss") st.misses++;
  }
  stats[attackerId] = st;

  let next: BattleshipGameState = {
    ...state,
    fleets: { ...state.fleets, [defenderId]: applied.fleet },
    shotsByAttacker: {
      ...state.shotsByAttacker,
      [attackerId]: applied.shots,
    },
    ap: {
      ...state.ap,
      [attackerId]: (state.ap[attackerId] ?? 0) + applied.result.apGain,
    },
    stats,
    lastActionLog: applied.result.logs.length
      ? applied.result.logs
      : [
          applied.result.cells[0]?.mark === "hit"
            ? "Hit!"
            : applied.result.cells[0]?.mark === "obscured"
              ? "Strike entered the smoke…"
              : "Miss.",
        ],
    privateIntel: { ...state.privateIntel, [attackerId]: null },
  };

  if (remainingCells(applied.fleet) === 0) {
    return {
      ...next,
      phase: "gameover",
      winnerId: attackerId,
      turnPlayerId: null,
      lastActionLog: [...next.lastActionLog, "All ships destroyed — victory!"],
    };
  }

  return endTurn(next, attackerId);
}

export function triggerPowerUp(
  state: BattleshipGameState,
  attackerId: string,
  type: PowerUpType,
  opts: {
    col: number;
    row: number;
    orientation?: Orientation;
    direction?: TorpedoDirection;
  }
): BattleshipGameState {
  if (state.phase !== "battle" || state.turnPlayerId !== attackerId) return state;
  const cost = powerUpCost(type);
  const ap = state.ap[attackerId] ?? 0;
  if (ap < cost) return state;

  const defenderId = opponentId(state, attackerId);
  let next: BattleshipGameState = {
    ...state,
    ap: { ...state.ap, [attackerId]: ap - cost },
    stats: {
      ...state.stats,
      [attackerId]: {
        ...state.stats[attackerId]!,
        powerUpsUsed: {
          ...state.stats[attackerId]!.powerUpsUsed,
          [type]: (state.stats[attackerId]!.powerUpsUsed[type] ?? 0) + 1,
        },
      },
    },
  };

  if (type === "sonar") {
    const ping = sonarDetectsShip(
      next.fleets[defenderId] ?? [],
      { col: opts.col, row: opts.row },
      next.smokeZones,
      defenderId
    );
    next = {
      ...next,
      privateIntel: {
        ...next.privateIntel,
        [attackerId]: {
          kind: "sonar",
          ping,
          center: { col: opts.col, row: opts.row },
        },
      },
      lastActionLog: [
        ping
          ? "Sonar: ship detected in zone."
          : "Sonar: no ships in zone.",
      ],
    };
    return endTurn(next, attackerId);
  }

  if (type === "smoke") {
    const cells = smokeCells({ col: opts.col, row: opts.row });
    next = {
      ...next,
      smokeZones: [
        ...next.smokeZones,
        { ownerId: attackerId, cells, turnsRemaining: 2 },
      ],
      lastActionLog: ["Smoke screen deployed over your fleet."],
    };
    return endTurn(next, attackerId);
  }

  if (type === "recon") {
    const orientation = opts.orientation ?? "horizontal";
    const index = orientation === "horizontal" ? opts.row : opts.col;
    const line = reconLine(index, orientation);
    const fleet = next.fleets[defenderId] ?? [];
    const cells = line.map((c) => ({
      ...c,
      hasShip: !!shipAt(fleet, c.col, c.row),
    }));
    const shots = { ...(next.shotsByAttacker[attackerId] ?? {}) };
    for (const c of cells) {
      const k = coordKey(c.col, c.row);
      const existing = shots[k];
      if (
        existing === "hit" ||
        existing === "miss" ||
        existing === "obscured"
      ) {
        continue;
      }
      shots[k] = c.hasShip ? "revealed_ship" : "revealed_empty";
    }
    next = {
      ...next,
      shotsByAttacker: { ...next.shotsByAttacker, [attackerId]: shots },
      privateIntel: {
        ...next.privateIntel,
        [attackerId]: { kind: "recon", cells },
      },
      lastActionLog: ["Air recon complete — line revealed."],
    };
    return endTurn(next, attackerId);
  }

  // Damaging power-ups
  let targets =
    type === "cluster"
      ? clusterCells({ col: opts.col, row: opts.row })
      : torpedoCells(
          { col: opts.col, row: opts.row },
          opts.direction ?? "E",
          next.fleets[defenderId] ?? [],
          next.shotsByAttacker[attackerId] ?? {}
        );

  const applied = applyStrikeCells(
    next.fleets[defenderId] ?? [],
    next.shotsByAttacker[attackerId] ?? {},
    targets,
    next.smokeZones,
    defenderId,
    type === "cluster" ? "Cluster" : "Torpedo"
  );

  const st = { ...next.stats[attackerId]! };
  st.shotsFired += applied.result.cells.length;
  for (const c of applied.result.cells) {
    if (c.mark === "hit") st.hits++;
    if (c.mark === "miss") st.misses++;
  }

  next = {
    ...next,
    fleets: { ...next.fleets, [defenderId]: applied.fleet },
    shotsByAttacker: {
      ...next.shotsByAttacker,
      [attackerId]: applied.shots,
    },
    ap: {
      ...next.ap,
      [attackerId]: (next.ap[attackerId] ?? 0) + applied.result.apGain,
    },
    stats: { ...next.stats, [attackerId]: st },
    lastActionLog: applied.result.logs.length
      ? applied.result.logs
      : [`${type === "cluster" ? "Cluster bomb" : "Torpedo"} resolved.`],
    privateIntel: { ...next.privateIntel, [attackerId]: null },
  };

  if (remainingCells(applied.fleet) === 0) {
    return {
      ...next,
      phase: "gameover",
      winnerId: attackerId,
      turnPlayerId: null,
      lastActionLog: [...next.lastActionLog, "All ships destroyed — victory!"],
    };
  }

  return endTurn(next, attackerId);
}

export function rematchBattleship(
  state: BattleshipGameState
): BattleshipGameState {
  return createBattleshipState(state.playerIds);
}

export {
  generateRandomFleetLayout,
  isCompleteFleet,
  validateFleet,
  remainingCells,
  computeApGain,
};
export type { CellMark, FleetPlacement };
