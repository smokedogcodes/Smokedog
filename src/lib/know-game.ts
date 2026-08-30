export const KNOW_GAME_KEY = "smokedog:know-game";

export function loadKnowGame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KNOW_GAME_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveKnowGame(value: boolean) {
  try {
    localStorage.setItem(KNOW_GAME_KEY, value ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
