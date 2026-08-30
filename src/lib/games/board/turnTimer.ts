/** Turn length for board games (seconds). */
export function boardTurnSeconds(daySeconds?: number): number {
  const n = daySeconds ?? 15;
  return Math.max(10, Math.min(60, n));
}
