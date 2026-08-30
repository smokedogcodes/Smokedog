import type { GameModule, RoomSettings, Role } from "@/lib/types";
import { BATTLESHIP_ID } from "./ships";

export { BATTLESHIP_ID };

export const battleshipModule: GameModule = {
  id: BATTLESHIP_ID,
  displayName: "Tactical Battleship",
  minPlayers: 2,
  maxPlayers: 2,
  status: "live",
  createSettings(): RoomSettings {
    return {
      nightSeconds: 30,
      daySeconds: 30,
      vigilanteBullets: null,
    };
  },
  assignRoles(playerCount: number): Role[] {
    return Array.from({ length: playerCount }, () => "villager" as Role);
  },
};
