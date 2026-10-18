import type { GameModule } from "@/lib/types";
import { mafiaCityModule } from "./mafia-city/engine";
import { fiveAliveModule } from "./5-alive/engine";
import { spotItModule } from "./spot-it/engine";
import { ticTacToeModule } from "./tic-tac-toe/engine";
import { connect4Module } from "./connect-4/engine";
import { explodingKittensModule } from "./exploding-kittens/engine";
import { battleshipModule } from "./battleship/engine";
import { codenamesModule } from "./codenames/engine";

const modules: Record<string, GameModule> = {
  [mafiaCityModule.id]: mafiaCityModule,
  [fiveAliveModule.id]: fiveAliveModule,
  [explodingKittensModule.id]: explodingKittensModule,
  [spotItModule.id]: spotItModule,
  [ticTacToeModule.id]: ticTacToeModule,
  [connect4Module.id]: connect4Module,
  [battleshipModule.id]: battleshipModule,
  [codenamesModule.id]: codenamesModule,
};

export function resolveGameId(id?: string): string {
  const normalized = (id ?? "").trim().toLowerCase();
  if (!normalized) return mafiaCityModule.id;

  if (
    normalized === "5-alive" ||
    normalized === "5alive" ||
    normalized === "fivealive" ||
    normalized === "five-alive"
  ) {
    return fiveAliveModule.id;
  }

  if (normalized === "mafia" || normalized === "mafia-city") {
    return mafiaCityModule.id;
  }

  if (
    normalized === "spot-it" ||
    normalized === "spotit" ||
    normalized === "dobble"
  ) {
    return spotItModule.id;
  }

  if (
    normalized === "tic-tac-toe" ||
    normalized === "tictactoe" ||
    normalized === "ttt"
  ) {
    return ticTacToeModule.id;
  }

  if (
    normalized === "connect-4" ||
    normalized === "connect4" ||
    normalized === "c4"
  ) {
    return connect4Module.id;
  }

  if (
    normalized === "detonation-cats" ||
    normalized === "exploding-kittens" ||
    normalized === "ek" ||
    normalized === "detonationcats" ||
    normalized === "explodingkittens"
  ) {
    return explodingKittensModule.id;
  }

  if (
    normalized === "battleship" ||
    normalized === "bs" ||
    normalized === "tactical-battleship"
  ) {
    return battleshipModule.id;
  }

  if (
    normalized === "codenames" ||
    normalized === "cn" ||
    normalized === "code-names"
  ) {
    return codenamesModule.id;
  }

  return normalized;
}

export function getGameModule(id = "mafia-city"): GameModule {
  const resolved = resolveGameId(id);
  const mod = modules[resolved];
  if (!mod) {
    throw new Error(
      `Game "${id ?? resolved}" is not available on this game server yet. Ask the host to redeploy the backend.`
    );
  }
  return mod;
}

export function listGames(): GameModule[] {
  return Object.values(modules);
}

export function listGameIds(): string[] {
  return Object.keys(modules);
}
