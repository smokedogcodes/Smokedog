export type PowerUpType =
  | "sonar"
  | "cluster"
  | "torpedo"
  | "smoke"
  | "recon";

export const POWERUP_COSTS: Record<PowerUpType, number> = {
  sonar: 3,
  cluster: 5,
  torpedo: 6,
  smoke: 4,
  recon: 7,
};

export const POWERUP_LABELS: Record<PowerUpType, string> = {
  sonar: "Sonar Pulse",
  cluster: "Cluster Bomb",
  torpedo: "Torpedo Strike",
  smoke: "Smoke Screen",
  recon: "Air Recon",
};

export const POWERUP_BLURBS: Record<PowerUpType, string> = {
  sonar: "Scan a 3×3 zone — ship detected? (no damage)",
  cluster: "Strike a + pattern (5 cells)",
  torpedo: "Fire a row or column until first ship hit",
  smoke: "Hide a 3×3 on your fleet for 2 turns",
  recon: "Reveal a full row or column (no damage)",
};

export type Orientation = "horizontal" | "vertical";
export type TorpedoDirection = "N" | "S" | "E" | "W";

export function powerUpCost(type: PowerUpType): number {
  return POWERUP_COSTS[type];
}
