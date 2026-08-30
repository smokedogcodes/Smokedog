import type { ShotMap, SmokeZone } from "./logic";
import type { FleetPlacement } from "./placement";
import type { PowerUpType } from "./powerups";

export type BattleshipPhase = "setup" | "battle" | "gameover";

export type PlayerStats = {
  shotsFired: number;
  hits: number;
  misses: number;
  powerUpsUsed: Record<PowerUpType, number>;
  turnsTaken: number;
};

export function emptyStats(): PlayerStats {
  return {
    shotsFired: 0,
    hits: 0,
    misses: 0,
    powerUpsUsed: {
      sonar: 0,
      cluster: 0,
      torpedo: 0,
      smoke: 0,
      recon: 0,
    },
    turnsTaken: 0,
  };
}

export type BattleshipGameState = {
  phase: BattleshipPhase;
  playerIds: [string, string];
  fleets: Record<string, FleetPlacement>;
  ready: Record<string, boolean>;
  /** Shots by attackerId → marks on defender's grid */
  shotsByAttacker: Record<string, ShotMap>;
  /** Revealed cells (recon) by viewer attacking → keys marked revealed_* */
  ap: Record<string, number>;
  smokeZones: SmokeZone[];
  turnPlayerId: string | null;
  winnerId: string | null;
  stats: Record<string, PlayerStats>;
  lastActionLog: string[];
  /** Pending sonar/recon feedback for the acting player only */
  privateIntel: Record<
    string,
    | { kind: "sonar"; ping: boolean; center: { col: number; row: number } }
    | {
        kind: "recon";
        cells: { col: number; row: number; hasShip: boolean }[];
      }
    | null
  >;
};

export function createBattleshipState(
  playerIds: [string, string]
): BattleshipGameState {
  const [a, b] = playerIds;
  return {
    phase: "setup",
    playerIds,
    fleets: { [a]: [], [b]: [] },
    ready: { [a]: false, [b]: false },
    shotsByAttacker: { [a]: {}, [b]: {} },
    ap: { [a]: 0, [b]: 0 },
    smokeZones: [],
    turnPlayerId: null,
    winnerId: null,
    stats: { [a]: emptyStats(), [b]: emptyStats() },
    lastActionLog: [],
    privateIntel: { [a]: null, [b]: null },
  };
}

export function opponentId(
  state: BattleshipGameState,
  playerId: string
): string {
  return state.playerIds[0] === playerId
    ? state.playerIds[1]!
    : state.playerIds[0]!;
}
