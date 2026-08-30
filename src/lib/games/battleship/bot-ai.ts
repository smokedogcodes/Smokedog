import { fireStandardShot, triggerPowerUp } from "./actions";
import { GRID_SIZE } from "./grid";
import { isAlreadyTargeted } from "./logic";
import { generateRandomFleetLayout } from "./placement";
import type { PowerUpType, TorpedoDirection } from "./powerups";
import type { BattleshipGameState } from "./state";
import { opponentId } from "./state";

export function botBattleshipDelayMs(): number {
  return 700 + Math.floor(Math.random() * 1100);
}

export function pickBotFleet() {
  return generateRandomFleetLayout();
}

function unfiredCells(state: BattleshipGameState, attackerId: string) {
  const shots = state.shotsByAttacker[attackerId] ?? {};
  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!isAlreadyTargeted(shots, col, row)) cells.push({ col, row });
    }
  }
  return cells;
}

function huntTargets(state: BattleshipGameState, attackerId: string) {
  const shots = state.shotsByAttacker[attackerId] ?? {};
  const adj: { col: number; row: number }[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (shots[`${col},${row}`] !== "hit") continue;
      for (const [dc, dr] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || c >= GRID_SIZE || r < 0 || r >= GRID_SIZE) continue;
        if (!isAlreadyTargeted(shots, c, r)) adj.push({ col: c, row: r });
      }
    }
  }
  return adj;
}

export function pickBotBattleAction(
  state: BattleshipGameState,
  botId: string
):
  | { kind: "fire"; col: number; row: number }
  | {
      kind: "powerup";
      type: PowerUpType;
      col: number;
      row: number;
      direction?: TorpedoDirection;
      orientation?: "horizontal" | "vertical";
    }
  | null {
  if (state.phase !== "battle" || state.turnPlayerId !== botId) return null;
  const ap = state.ap[botId] ?? 0;
  const pool = huntTargets(state, botId);
  const open = unfiredCells(state, botId);
  if (open.length === 0) return null;

  if (ap >= 5 && Math.random() < 0.25) {
    const c = (pool[0] ?? open[Math.floor(Math.random() * open.length)])!;
    return { kind: "powerup", type: "cluster", col: c.col, row: c.row };
  }

  if (ap >= 6 && Math.random() < 0.15) {
    const c = open[Math.floor(Math.random() * open.length)]!;
    const dirs: TorpedoDirection[] = ["N", "S", "E", "W"];
    return {
      kind: "powerup",
      type: "torpedo",
      col: c.col,
      row: c.row,
      direction: dirs[Math.floor(Math.random() * 4)]!,
    };
  }

  const pick =
    pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]!
      : open[Math.floor(Math.random() * open.length)]!;
  return { kind: "fire", col: pick.col, row: pick.row };
}

export function applyBotBattleAction(
  state: BattleshipGameState,
  botId: string
): BattleshipGameState {
  const action = pickBotBattleAction(state, botId);
  if (!action) return state;
  if (action.kind === "fire") {
    return fireStandardShot(state, botId, action.col, action.row);
  }
  return triggerPowerUp(state, botId, action.type, {
    col: action.col,
    row: action.row,
    direction: action.direction,
    orientation: action.orientation,
  });
}

export function botNeedsReady(
  state: BattleshipGameState,
  botId: string
): boolean {
  return state.phase === "setup" && !state.ready[botId];
}

void opponentId;
