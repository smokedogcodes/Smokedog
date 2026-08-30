import type { GameModule } from "@/lib/types";
import { EXPLODING_KITTENS_ID } from "./cards";

export const explodingKittensModule: GameModule = {
  id: EXPLODING_KITTENS_ID,
  displayName: "Exploding Kittens",
  minPlayers: 2,
  maxPlayers: 5,
  status: "live",
  createSettings: () => ({
    nightSeconds: 60,
    daySeconds: 90,
    vigilanteBullets: null,
    roleDistribution: null,
    localMode: false,
  }),
  assignRoles: () => ["villager" as const],
};
