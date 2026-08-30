export const BATTLESHIP_ID = "battleship";

export type ShipType =
  | "carrier"
  | "battleship"
  | "cruiser"
  | "submarine"
  | "destroyer";

export type ShipDef = {
  type: ShipType;
  label: string;
  length: number;
};

export const FLEET_ROSTER: ShipDef[] = [
  { type: "carrier", label: "Carrier", length: 5 },
  { type: "battleship", label: "Battleship", length: 4 },
  { type: "cruiser", label: "Cruiser", length: 3 },
  { type: "submarine", label: "Submarine", length: 3 },
  { type: "destroyer", label: "Destroyer", length: 2 },
];

export const TOTAL_SHIP_CELLS = FLEET_ROSTER.reduce((n, s) => n + s.length, 0);

export function shipLabel(type: ShipType): string {
  return FLEET_ROSTER.find((s) => s.type === type)?.label ?? type;
}

export function shipLength(type: ShipType): number {
  return FLEET_ROSTER.find((s) => s.type === type)?.length ?? 0;
}
