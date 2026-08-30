import type { GameModule, RoomSettings, Role } from "@/lib/types";

export const FIVE_ALIVE_ID = "five-alive";

export const fiveAliveModule: GameModule = {
  id: FIVE_ALIVE_ID,
  displayName: "5 Alive",
  minPlayers: 2,
  maxPlayers: 6,
  status: "live",
  createSettings(): RoomSettings {
    // Reuse the shared RoomSettings for timer plumbing.
    // - We'll interpret `daySeconds` as "turn seconds" for 5 Alive.
    // - `nightSeconds` can be ignored (or used later for bomb resolution timers).
    return {
      nightSeconds: 15,
      daySeconds: 60,
      vigilanteBullets: null,
    };
  },
  assignRoles(playerCount: number, _settings: RoomSettings): Role[] {
    // 5 Alive does not use Mafia City roles. We return dummy values to satisfy
    // the shared `GameModule` interface.
    return Array.from({ length: playerCount }, () => "villager" as Role);
  },
};

