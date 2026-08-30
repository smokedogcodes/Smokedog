export const GRID_SIZE = 10;

export type Coord = { col: number; row: number }; // 0-9

export const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE;
}

export function coordKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseCoordKey(key: string): Coord {
  const [c, r] = key.split(",").map(Number);
  return { col: c!, row: r! };
}

export function formatCoord(col: number, row: number): string {
  return `${COL_LABELS[col] ?? "?"}${row + 1}`;
}

export function neighbors4(col: number, row: number): Coord[] {
  return [
    { col, row: row - 1 },
    { col, row: row + 1 },
    { col: col - 1, row },
    { col: col + 1, row },
  ].filter((c) => inBounds(c.col, c.row));
}
