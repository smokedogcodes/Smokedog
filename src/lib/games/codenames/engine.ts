import type { GameModule, Role, RoomSettings } from "@/lib/types";

export const CODENAMES_ID = "codenames";

export const codenamesModule: GameModule = {
  id: CODENAMES_ID,
  displayName: "Codenames",
  minPlayers: 2,
  maxPlayers: 16,
  status: "live",
  createSettings(): RoomSettings {
    return {
      nightSeconds: 60, // used as Spymaster Clue timer
      daySeconds: 90,   // used as Operatives Guess timer
      vigilanteBullets: null,
      codenamesClueSeconds: 60,
      codenamesGuessSeconds: 90,
    };
  },
  assignRoles(playerCount: number): Role[] {
    return Array.from({ length: playerCount }, () => "villager" as Role);
  },
};
