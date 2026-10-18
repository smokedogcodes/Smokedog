import type { GameModule } from "@/lib/types";

export function gameLabel(gameId: string): string {
  switch (gameId) {
    case "five-alive":
      return "5 Alive";
    case "exploding-kittens":
    case "detonation-cats":
      return "Exploding Kittens";
    case "mafia-city":
      return "Mafia City";
    case "spot-it":
      return "Spot It";
    case "tic-tac-toe":
      return "Tic-Tac-Toe";
    case "connect-4":
      return "Connect 4";
    case "battleship":
      return "Tactical Battleship";
    case "codenames":
      return "Codenames";
    default:
      return gameId;
  }
}

export function isMaintenanceGame(mod: GameModule): boolean {
  return mod.status === "maintenance";
}
